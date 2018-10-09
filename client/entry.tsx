// Copyright (c) 2014-2018, Spookfish Innovations Pty Ltd, Australia. All rights reserved.

import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.scss';
  
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AuthenticationMethods } from './authTypes';
import { MapTypeButton } from './MapType.button';

export class Map extends React.PureComponent<IMapProps, IMapState> {
    private map: L.Map;
    private layer: L.TileLayer
    private readonly apiKey = '<YOUR API KEY HERE>';
    private readonly apiBaseUrl = 'https://api.spookfish.com/api/imagery/v1/';
    // You can change this to get imagery up to specific dates, but in this case get the latest
    private readonly imageryProductId = 'Best';

    constructor(props: IMapProps) {
        super(props);
        this.state = { authenticationMethod: 'ApiKey', accessToken: undefined };
    }

    componentDidMount() {
        this.getClientCredentialsToken();
        this.map = L.map('map', {center: new L.LatLng(-31.950293, 115.8901672), zoom: 18})
            .on('click', this.onMapClicked);
        this.setupLayer();
    }

    render() {
        return (
            <>
                <div id="map"></div>
                <div className="buttons">
                    <MapTypeButton name="Api Key" auth="ApiKey" selectedAuth={this.state.authenticationMethod} changeAuth={this.changeLayer} />
                    <MapTypeButton name="Client Credentials" auth="ClientCredentials" selectedAuth={this.state.authenticationMethod} changeAuth={this.changeLayer} />
                </div>
            </>
        );
    }

    private changeLayer = (auth: AuthenticationMethods) => {
        if (this.layer) {
            this.layer.remove();
        }

        this.setState({ authenticationMethod: auth }, this.setupLayer);
    }

    private setupLayer = async () => {
        const auth = this.getAuthQueryParam();

        // Retrieve the tile limits from the API.
        const response = await fetch(`${this.apiBaseUrl}limits?${auth}`);
        if (!response.ok) {
            console.error(`${response.status} ${response.statusText}`);
        } else {
            let limits = await response.json();
            // Now we have the limits, setup the layer
            this.layer = L.tileLayer(`${this.apiBaseUrl}${this.imageryProductId}/tiles/{z}/{x}/{y}?format=image/jpeg&${auth}`, {
                tms: true,
                minZoom: limits.tilesLimits.minimumZoom,
                maxZoom: limits.tilesLimits.maximumZoom,
                attribution: 'Map data <a href="https://www.spookfish.com" target="_blank">&copy; Spookfish</a>'
            })
            .addTo(this.map);
        }
    }

    private getAuthQueryParam = () => {
        if (this.state.authenticationMethod === 'ClientCredentials') {
            return 'access_token=' + this.state.accessToken;
        } else {
            return 'api_key=' + this.apiKey;
        }
    }

    private getClientCredentialsToken = async () => {
        // From your map client, you will need to call a secured service that you have setup to get a short lived token from the Spookfish
        // server which can be used by this client
        const response = await fetch('http://localhost:9090/api/token');
        if (!response.ok) {
            console.error(`${response.status} ${response.statusText}`);
        } else {
            let token = await response.json()
            this.setState(
                { accessToken: token.access_token },
                // After we've set the new access token, we need to reload the leaflet layer so it sends new requests with the token
                () => this.changeLayer(this.state.authenticationMethod)
            );
            // Our token will expire, so register a callback to get a new one for when it does
            setTimeout(this.getClientCredentialsToken, token.expires_in * 1000);
        }
    }

    private onMapClicked = async (click: L.LeafletMouseEvent) => {
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

        // Spookfish is using TMS, so need to flip the Y-coordinates
        var ymax = 1 << zoom;
        tile.y = ymax - tile.y - 1;
        
        const response = await fetch(`${this.apiBaseUrl}${this.imageryProductId}/tiles/${zoom}/${tile.x}/${tile.y}/info/${tilePixel.x}/${tilePixel.y}?${this.getAuthQueryParam()}`);
        if (response.ok) {
            let info = await response.json();
            L.popup()
                .setLatLng(click.latlng)
                .setContent(`Lat long ${click.latlng.lat}, ${click.latlng.lng} captured on ${info.captureDate}`)
                .openOn(this.map);
        }
    }
}

interface IMapProps {
    
}

interface IMapState {
    authenticationMethod: AuthenticationMethods;
    accessToken: string;
}

ReactDOM.render(<Map />, document.querySelector('.app'));