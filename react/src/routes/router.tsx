import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home";
import HomeGS from "../pages/HomeGS";
import Login from "../pages/Login";
import Register from "../pages/Registration";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />
    },
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },
    {
        path: "/test",
        element: <Home />
    }
]);