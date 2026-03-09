import React from 'react'
import ReactDOM from 'react-dom/client'
import CustomerApp from './brew-customer.jsx'
import WaiterApp from './brew-waiter.jsx'

const isWaiter = window.location.pathname.includes('/waiter');

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isWaiter ? <WaiterApp /> : <CustomerApp />}
    </React.StrictMode>
)
