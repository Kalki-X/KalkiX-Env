import React, { useEffect, useState } from 'react';

const Template = () => {

    useEffect(() => {
        document.title = 'GearShare - Home';
    }, []); // Empty dependency array ensures it runs once when the component mounts

    const [count, setCount] = useState(0);

    const increase = () => {
        console.log("Hello World");
        setCount(count + 1);
    };

    return (
        <div style={{ margin: "50px" }}>
            <h1>GearShare</h1>

            <h3>Functional Page Template</h3>

            <h2>{count}</h2>

        </div>
    );
};

export default Template;