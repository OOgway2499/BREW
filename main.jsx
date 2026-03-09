import React from 'react'
import ReactDOM from 'react-dom/client'
import CustomerApp from './brew-customer.jsx'
import WaiterApp from './brew-waiter.jsx'

const path = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {path.includes("waiter") ? <WaiterApp /> : <CustomerApp />}
    </React.StrictMode>,
)
