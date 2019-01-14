// Copyright (c) 2014-2018, Spookfish Innovations Pty Ltd, Australia. All rights reserved.

import { UrlFunc } from "./urlCreator";
import { ICompositeProductsSummary, ICompositeProductDetails } from "../shared/ICompositeProduct";
const fetch = require('node-fetch');
const request = require('request');

let cachedCompositeProducts;

export const compositeProductService = {
    getCompositeProducts: async (url: UrlFunc) => {
        if (!cachedCompositeProducts) {
            cachedCompositeProducts = await getCompositeProductsForPerth(url);
        }
        return cachedCompositeProducts;
    }
};

async function getCompositeProductsForPerth(url: UrlFunc) {
    const allCompositeProducts = await getAllCompositeProducts(url);
    const perthCompositeProducts = filterToPerthOnly(allCompositeProducts);
    return await getCompositeProductDetails(perthCompositeProducts, url);
}

function getAllCompositeProducts(url: UrlFunc): Promise<ICompositeProductsSummary[]> {
    return new Promise((resolve, reject) => {
        // We want to call the index of the imagery service
        request.get(url(''), (error, r, body) => {
            if (error || r.statusCode !== 200) {
                reject(`HTTP ${r.statusCode}: ${error}`);
            } else {
                const response = JSON.parse(body);
                resolve(response.products);
            }
        });
    });
}

const perthLat = -31.9510894;
const perthLong = 115.8869623;
function filterToPerthOnly(allProducts: ICompositeProductsSummary[]): ICompositeProductsSummary[] {
    return allProducts.filter((product) => {
        let containsPerth = false
        // The 'Only' composite products contains the bounding box for only that composite product. Also include Best which will
        // choose the best composite product available for each location.
        if (product.constraintType === 'Only' || product.constraintType === 'Best') {
            const { bottomLeft, topRight } = product.boundingBox
            containsPerth =
                bottomLeft.longitude <= perthLong && perthLong <= topRight.longitude &&
                bottomLeft.latitude <= perthLat && perthLat <= topRight.latitude;
        }

        return containsPerth;
    });
}

function getCompositeProductDetails(products: ICompositeProductsSummary[], url: UrlFunc): Promise<ICompositeProductDetails[]> {
    try {
        const promises = products.map(async product => {
            const response = await fetch(url(product.title));

            if (response.ok) {
                const json = await response.json();
                return {
                    ...product,
                    bounds: json.bounds
                } as ICompositeProductDetails;
            } else {
                console.log(`Unable to retrieve product details for ${product.title}`);
            }
        });

        // Wait for all promises to complete, then filter out any undefined ones, order it by date descending
        return Promise.all(promises).then(products => 
            products
                // Filter out any that we had troubles receiving, so we don't return undefineds
                .filter(p => !!p)
                // Sort by date descending, as generally want more relevant first. Note that on the client you might want to filter this again
                // by constraint type, if you've included them all. In this demo we are only returning 'Best' and 'Only' types.
                .sort((a, b) => {
                    if (a.constraintDate > b.constraintDate) {
                        return -1;
                    }
                    if (a.constraintDate < b.constraintDate) {
                        return 1;
                    }
                    return 0;
                })
        );
    } catch(error) {
        // You should do something meaningful here, but this is just for demo purposes
        console.log(error);
    }
}