// Copyright (c) 2014-2019, EagleView. All rights reserved.

import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.scss';
  
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AuthenticationMethods } from './authTypes';
import { MapTypeButton } from './MapType.button';
import { CompositeProductPickerComponent } from './CompositeProductPicker.component';
import { httpClient } from './httpClient';
import { IToken } from '../shared/IToken';
import { ICompositeProductDetails } from '../shared/ICompositeProduct';
import { ILimits } from '../shared/ILimits';

export class Map extends React.PureComponent<IMapProps, IMapState> {
    private map: L.Map;
    private layer: L.TileLayer
    private readonly serverUrl = 'http://localhost:9090/api';

    constructor(props: IMapProps) {
        super(props);
        this.state = { 
            authenticationMethod: 'ApiKey',
            accessToken: undefined,
            apiKey: undefined,
            apiBaseUrl: undefined,
            products: [],
            productsLoaded: false,
            selectedProduct: undefined,
            limits: undefined
        };
    }

    componentDidMount() {
        this.map = L
            .map('map', {
                center: new L.LatLng(-31.958238, 115.855293), 
                zoom: 18,
                // With the composite product selector dropdown, we aren't tracking the location in the demo and updating it, so restrict the
                // map to a section where those composite products make sense.
                maxBounds: [
                    [-31.973207, 115.836326], // Southwest
                    [-31.941969, 115.891474] // Northeast
                ],
                maxBoundsViscosity: 1
            })
            .on('click', this.onMapClicked);
        // Don't await these, let them fire off asynchronously so we don't hold up rendering
        this.getConfig();
    }

    render() {
        return (
            <>
                <div id="map"></div>
                <div className="top-buttons">
                    <MapTypeButton name="Api Key" auth="ApiKey" selectedAuth={this.state.authenticationMethod} changeAuth={this.setAuthMethod} />
                    <MapTypeButton name="Client Credentials" auth="ClientCredentials" selectedAuth={this.state.authenticationMethod} changeAuth={this.setAuthMethod} />
                </div>
                <div className="bottom-buttons">
                    <CompositeProductPickerComponent areProductsLoaded={this.state.productsLoaded} products={this.state.products} selectedProduct={this.state.selectedProduct}
                        productChanged={this.selectedProductChanged} />
                </div>
            </>
        );
    }

    private setAuthMethod = (auth: AuthenticationMethods) => {
        if (this.layer) {
            this.layer.remove();
            this.layer = undefined;
        }

        this.setState({ authenticationMethod: auth }, this.setupLayer);
    }

    private getConfig = async () => {
        const config = await httpClient.get(`${this.serverUrl}/config`);

        if (config) {
            this.setState({ apiBaseUrl: config.apiBaseUrl, apiKey: config.apiKey }, this.setupLayer);
        }
    }

    private loadCompositeProducts = async () => {
        const products = await httpClient.get(`${this.serverUrl}/products`) as ICompositeProductDetails[];
        if (products) {
            this.setState({ products, productsLoaded: true });
            if (!this.state.selectedProduct && products.length) {
                // Don't currently have a composite product, but we have one loaded, select one!
                this.selectedProductChanged(products[0]);
            }
        }
    }

    private selectedProductChanged = (newProduct: ICompositeProductDetails) => {
        this.setState({ selectedProduct: newProduct }, this.createLayer);
    }

    private setupLayer = async () => {
        if (!this.state.apiBaseUrl) {
            return;
        }

        if (this.state.authenticationMethod === 'ClientCredentials' && !this.state.accessToken) {
            await this.getClientCredentialsToken();
        }

        const auth = this.getAuthQueryParam();

        if (auth) {
            // Don't add the layer until we have composite products loaded
            await this.loadCompositeProducts();
            // Need to know the zoom limits so we can tell mapbox about the restrictions
            const limits = await httpClient.get(`${this.state.apiBaseUrl}limits?${auth}`)
            this.setState({ limits }, this.createLayer);
        }   
    }

    private createLayer = () => {
        if (this.state.limits && this.state.selectedProduct) {
            const auth = this.getAuthQueryParam();

            if (auth) {
                if (this.layer) {
                    this.layer.remove();
                    this.layer = undefined;
                }

                // Now we have the limits, setup the layer
                this.layer = L.tileLayer(`${this.state.apiBaseUrl}${this.state.selectedProduct.title}/tiles/{z}/{x}/{y}?format=image/jpeg&${auth}`, {
                    minZoom: this.state.limits.tilesLimits.minimumZoom,
                    maxZoom: this.state.limits.tilesLimits.maximumZoom,
                    attribution: 'Map data <a href="https://au.eagleview.com" target="_blank">&copy; EagleView</a>'
                })
                .addTo(this.map);
            }
        }
    }

    private getAuthQueryParam = () => {
        if (this.state.authenticationMethod === 'ClientCredentials') {
            return this.state.accessToken ? 'access_token=' + this.state.accessToken : undefined;
        } else {
            return this.state.apiKey ? 'api_key=' + this.state.apiKey : undefined;
        }
    }

    private getClientCredentialsToken = async () => {
        // From your map client, you will need to call a secured service that you have setup to get a short lived token from the EagleView Australia
        // server which can be used by this client
        const token: IToken = await httpClient.get(`${this.serverUrl}/token`);
        if (token) {
            this.setState(
                { accessToken: token.access_token },
                // After we've set the new access token, we need to reload the leaflet layer so it sends new requests with the token
                () => this.setAuthMethod(this.state.authenticationMethod)
            );
            // Our token will expire, so register a callback to get a new one for when it does
            setTimeout(this.getClientCredentialsToken, token.expires_in * 1000);
        }
    }

    private onMapClicked = async (click: L.LeafletMouseEvent) => {
        if (!this.state.apiBaseUrl || !this.state.selectedProduct) {
            return
        }

        const zoom = this.map.getZoom();
        const crs = this.map.options.crs;
        const pixelOrigin = this.map.getPixelOrigin();
        const tileSize = this.layer.getTileSize().x;

        // Want to convert latlong to tile pixel coordinates, adapted from:
        // https://stackoverflow.com/questions/40986573/project-leaflet-latlng-to-tile-pixel-coordinates
        const layerPoint = crs.latLngToPoint(click.latlng, zoom).floor();
        // Get the slippy tile coordinates
        let tile = layerPoint.divideBy(tileSize).floor();

        // Get the corner of our tile, adjusted for the pixelOrigin
        const tileCorner = tile.multiplyBy(tileSize).subtract(pixelOrigin);
        const tilePixel = layerPoint.subtract(pixelOrigin).subtract(tileCorner);

        const info = await httpClient.get(`${this.state.apiBaseUrl}${this.state.selectedProduct.title}/tiles/${zoom}/${tile.x}/${tile.y}/info/${tilePixel.x}/${tilePixel.y}?${this.getAuthQueryParam()}`);
        if (info) {
            L.popup()
                .setLatLng(click.latlng)
                .setContent(`<p>Location: <b>${click.latlng.lat}, ${click.latlng.lng}</b></p><p>Captured: <b>${info.captureDate}</b></p>`)
                .openOn(this.map);
        }
    }
}

interface IMapProps {
    
}

interface IMapState {
    authenticationMethod: AuthenticationMethods;
    accessToken: string;
    apiKey: string;
    apiBaseUrl: string
    products: ICompositeProductDetails[]
    productsLoaded: boolean
    selectedProduct: ICompositeProductDetails
    limits: ILimits
}

ReactDOM.render(<Map />, document.querySelector('.app'));