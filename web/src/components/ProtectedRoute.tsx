import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">Loading session...</div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}
