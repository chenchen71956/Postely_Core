import { Link, Route, Routes } from 'react-router-dom'
import { Component as AuthPage } from './auth'
import { Component as RegisterPage } from './auth/register'
import { Toast } from '@base-ui-components/react/toast'
import './assets/css/App.css'

function HomePage() {
  return (
    <div className="card">
      <h1>Home</h1>
      <p>示例：页面即文件夹。前往认证页：</p>
      <p>
        <Link to="/auth">/auth</Link>
      </p>
    </div>
  )
}

function App() {
  return (
    <>
      <Toast.Provider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
        </Routes>
      </Toast.Provider>
    </>
  )
}

export default App
