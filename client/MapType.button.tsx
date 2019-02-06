// Copyright (c) 2014-2019, EagleView. All rights reserved.

import * as React from 'react';
import { AuthenticationMethods } from './authTypes';

export class MapTypeButton extends React.PureComponent<IMapTypeButtonProps, IMapTypeButtonState> {
    constructor(props: IMapTypeButtonProps) {
        super(props);
    }
    
    render() {
        return <a className={'button' + (this.props.auth === this.props.selectedAuth ? ' selected': '')}
            onClick={() => this.props.changeAuth(this.props.auth)}
        >{this.props.name}</a>
    }
}

interface IMapTypeButtonProps {
    name: string;
    auth: AuthenticationMethods;
    selectedAuth: AuthenticationMethods;
    changeAuth(auth: AuthenticationMethods);
}

interface IMapTypeButtonState {
    
}