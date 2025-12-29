import React from 'react';
import { Link } from 'react-router-dom';

const PageNotFound = () => {
    return (
        <>
        <title>404 - Page not found</title>
        <div style={{ textAlign: 'center', marginTop: '50px', width: '100%', height:'90vh', alignContent:'center', alignItems:'center' }}>
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The page you are looking for does not exist.</p>
            <Link to="/" style={{ textDecoration: 'none', color: 'blue' }}>
                Go Back to Main page
            </Link>
        </div>
        </>
    );
};

export default PageNotFound;