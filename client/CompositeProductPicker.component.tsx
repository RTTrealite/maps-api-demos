// Copyright (c) 2014-2019, EagleView. All rights reserved.

import * as React from 'react';
import { ICompositeProductDetails } from '../shared/ICompositeProduct';

export class CompositeProductPickerComponent extends React.PureComponent<ICompositeProductPickerProps, ICompositeProductPickerState> {
    render() {
        const options = this.props.products
            .map(p =>
                <option value={p.title} key={p.title}>{p.title}</option>
            );

        if (!options.length) {
            options.push(
                <option value={undefined} key='<no_products>'>Nothing here</option>
            );
        }

        return (
            <div id="compositeProductPicker">
                {this.props.areProductsLoaded ? (
                    <select className="button" value={this.props.selectedProduct ? this.props.selectedProduct.title : undefined} onChange={this.productChanged}>
                        { options }
                    </select>
                ) : (
                    <div className="button">Loading...</div>
                )}
            </div>
        )
    }

    private productChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (!this.props.areProductsLoaded) {
            return;
        }
        
        const newProduct = this.props.products.find(p => p.title === event.currentTarget.value);

        if (newProduct) {
            this.props.productChanged(newProduct);
        }
    }
}

interface ICompositeProductPickerProps {
    areProductsLoaded: boolean
    products: ICompositeProductDetails[]
    selectedProduct: ICompositeProductDetails
    productChanged: (product: ICompositeProductDetails) => void
}

interface ICompositeProductPickerState {

}