// Copyright (c) 2014-2019, EagleView. All rights reserved.

import { IBoundingBox } from "./IBoundingBox";

export interface ICompositeProductsSummary {
    title: string
    constraintType: 'Only' | 'UpTo' | 'Best'
    constraintDate: Date
    _links: { self: { href: string } }
    boundingBox: IBoundingBox
}

export interface ICompositeProductDetails extends ICompositeProductsSummary{
    bounds: GeoJSON.Polygon
}