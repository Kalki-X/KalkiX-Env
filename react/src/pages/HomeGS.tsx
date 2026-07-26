import React, { useEffect, useState } from 'react';
import {Layout} from 'antd';
import HeaderComponent from '../components/Header/Header';
import FooterComponent from '../components/Footer/Footer';

const HomeGS = () => {

    useEffect(() => {
        document.title = 'GearShare - Rent Smarter';
    }, []);

    return (
        <Layout style={{ minHeight: '100vh', background: '#E7EEF7' }}>

            <HeaderComponent />

            <FooterComponent />

        </Layout>
    );
};

export default HomeGS;