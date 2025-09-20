'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Request {
  id: string
  type: string
  status: string
  photo_url: string | null
  created_at: string
  tables: {
    label: string
    x_position: number
    y_position: number
    restaurants: {
      name: string
    }
  }
}

interface TableWithRequests {
  id: string
  label: string
  x_position: number
  y_position: number
  restaurant_id: string
  activeRequests: Request[]
  urgentCount: number
  pendingCount: number
  status: 'no_requests' | 'pending' | 'urgent'
}

const requestConfig = {
  'table_clean': { 
    icon: '🧽', 
    label: 'Table Cleaning',
    color: '#06b6d4',
    bgColor: '#ecfeff',
    borderColor: '#67e8f9',
    priority: 'medium'
  },
  'toilet_clean': { 
    icon: '🚽', 
    label: 'Restroom Issue',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    priority: 'high'
  },
  'ready_to_order': { 
    icon: '🍽️', 
    label: 'Ready to Order',
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    priority: 'high'
  },
  'additional_order': { 
    icon: '➕', 
    label: 'Additional Order',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    priority: 'medium'
  },
  'replace_cutlery': { 
    icon: '🍴', 
    label: 'Cutlery Request',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
    priority: 'low'
  },
  'request_sauces': { 
    icon: '🥫', 
    label: 'Condiments',
    color: '#ec4899',
    bgColor: '#fdf2f8',
    borderColor: '#f9a8d4',
    priority: 'low'
  }
}

const statusConfig = {
  'pending': { 
    color: '#f59e0b', 
    bg: '#fffbeb', 
    border: '#fcd34d',
    icon: '⏳',
    label: 'Pending'
  },
  'in_progress': { 
    color: '#3b82f6', 
    bg: '#eff6ff', 
    border: '#93c5fd',
    icon: '🔄',
    label: 'In Progress'
  },
  'completed': { 
    color: '#10b981', 
    bg: '#ecfdf5', 
    border: '#6ee7b7',
    icon: '✅',
    label: 'Completed'
  }
}

export default function StaffRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [tables, setTables] = useState<TableWithRequests[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'layout'>('split')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    fetchData()
    
    const interval = setInterval(() => {
      fetchData()
      setLastRefresh(new Date())
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select(`
          *,
          tables (
            id,
            label,
            x_position,
            y_position,
            restaurant_id,
            restaurants (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (requestsError) throw requestsError
      setRequests(requestsData || [])

      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .order('label')

      if (tablesError) throw tablesError

      const processedTables: TableWithRequests[] = tablesData.map(table => {
        const tableRequests = requestsData.filter(req => 
          req.tables.id === table.id && 
          (req.status === 'pending' || req.status === 'in_progress')
        )

        const urgentCount = tableRequests.filter(req => {
          const config = requestConfig[req.type as keyof typeof requestConfig]
          return config?.priority === 'high'
        }).length

        const pendingCount = tableRequests.filter(req => req.status === 'pending').length

        let status: 'no_requests' | 'pending' | 'urgent' = 'no_requests'
        if (urgentCount > 0) status = 'urgent'
        else if (pendingCount > 0) status = 'pending'

        return {
          id: table.id,
          label: table.label,
          x_position: table.x_position || 0,
          y_position: table.y_position || 0,
          restaurant_id: table.restaurant_id,
          activeRequests: tableRequests,
          urgentCount,
          pendingCount,
          status
        }
      })

      setTables(processedTables)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating request:', error)
    }
  }

  const resetAllRequests = async () => {
    setResetting(true)
    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (this condition is always true)

      if (error) throw error
      
      setShowResetModal(false)
      fetchData()
      
      // Show success message briefly
      setTimeout(() => {
        alert('✅ All requests cleared successfully!')
      }, 500)
      
    } catch (error) {
      console.error('Error resetting requests:', error)
      alert('❌ Error clearing requests. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return 'A while ago'
  }

  const getFilteredRequests = () => {
    let filtered = requests

    if (filter !== 'all') {
      filtered = filtered.filter(r => r.status === filter)
    }

    if (selectedTable) {
      filtered = filtered.filter(r => r.tables.id === selectedTable)
    }

    return filtered
  }

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    total: requests.length,
    urgent: tables.reduce((acc, table) => acc + table.urgentCount, 0)
  }

  const getTableColor = (table: TableWithRequests) => {
    switch (table.status) {
      case 'urgent': return '#ef4444'
      case 'pending': return '#f59e0b'
      default: return '#10b981'
    }
  }

  const getTableBgColor = (table: TableWithRequests) => {
    switch (table.status) {
      case 'urgent': return '#fef2f2'
      case 'pending': return '#fffbeb'
      default: return '#ecfdf5'
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          textAlign: 'center',
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px'
          }}></div>
          <h3 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '18px', fontWeight: '600' }}>
            Loading Dashboard
          </h3>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes urgentPulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
        }
        
        @keyframes rainbow {
          0% { border-color: #ef4444; }
          16% { border-color: #f59e0b; }
          33% { border-color: #10b981; }
          50% { border-color: #3b82f6; }
          66% { border-color: #8b5cf6; }
          83% { border-color: #ec4899; }
          100% { border-color: #ef4444; }
        }
        
        .request-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
        }
        
        .request-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          animation: rainbow 2s linear infinite;
        }
        
        .table-circle {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .table-circle:hover {
          transform: scale(1.15);
        }
        
        .table-circle.urgent {
          animation: urgentPulse 2s infinite;
        }
        
        .stat-card {
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }
        
        .stat-card:hover {
          transform: translateY(-2px) scale(1.02);
          border: 2px solid rgba(255,255,255,0.3);
        }
        
        .reset-button {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          transition: all 0.3s ease;
        }
        
        .reset-button:hover {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          transform: scale(1.05);
          box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4);
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.3s ease-out;
        }
        
        .modal-content {
          background: white;
          border-radius: 20px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          animation: slideIn 0.4s ease-out;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px'
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '32px',
            marginBottom: '24px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap' as const,
              gap: '16px'
            }}>
              <div>
                <h1 style={{ 
                  fontSize: '36px', 
                  fontWeight: '700', 
                  margin: '0 0 8px 0', 
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  🏪 Staff Dashboard
                </h1>
                <p style={{ 
                  color: '#6b7280', 
                  margin: 0, 
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: '#10b981' }}>🟢 Live</span>
                  Updated: {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* View Mode Toggle */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  padding: '4px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}>
                  {[
                    { key: 'split', icon: '📊' },
                    { key: 'list', icon: '📋' },
                    { key: 'layout', icon: '🗺️' }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => setViewMode(mode.key as any)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: viewMode === mode.key ? '#667eea' : 'transparent',
                        color: viewMode === mode.key ? 'white' : '#64748b',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {mode.icon}
                    </button>
                  ))}
                </div>

                {/* Reset Button */}
                <button
                  onClick={() => setShowResetModal(true)}
                  className="reset-button"
                  style={{
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  🗑️ Clear All
                </button>

                {stats.urgent > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    animation: 'pulse 2s infinite',
                    boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)'
                  }}>
                    🚨 {stats.urgent} URGENT
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {[
              { label: 'Urgent', count: stats.urgent, gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '🚨' },
              { label: 'Pending', count: stats.pending, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '⏳' },
              { label: 'Active', count: stats.inProgress, gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: '🔄' },
              { label: 'Done Today', count: stats.completed, gradient: 'linear-gradient(135deg, #10b981, #059669)', icon: '✅' },
              { label: 'Total', count: stats.total, gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', icon: '📊' }
            ].map((stat, index) => (
              <div 
                key={stat.label} 
                className="stat-card"
                style={{
                  background: stat.gradient,
                  borderRadius: '20px',
                  padding: '28px 24px',
                  color: 'white',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  animation: `slideIn 0.6s ease-out ${index * 0.1}s both`
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '700'
                  }}>
                    {stat.count}
                  </div>
                  <div style={{
                    fontSize: '24px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    padding: '8px',
                    borderRadius: '12px'
                  }}>
                    {stat.icon}
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.5px',
                  opacity: 0.9
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
            gap: '24px',
            alignItems: 'start'
          }}>

            {/* Requests List */}
            {(viewMode === 'split' || viewMode === 'list') && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                overflow: 'hidden'
              }}>
                {/* Filter Tabs */}
                <div style={{
                  padding: '24px 32px 0 32px'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '24px',
                    flexWrap: 'wrap' as const
                  }}>
                    {[
                      { key: 'all', label: 'All', count: stats.total, color: '#8b5cf6' },
                      { key: 'pending', label: 'Pending', count: stats.pending, color: '#f59e0b' },
                      { key: 'in_progress', label: 'Active', count: stats.inProgress, color: '#3b82f6' },
                      { key: 'completed', label: 'Done', count: stats.completed, color: '#10b981' }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        style={{
                          padding: '12px 18px',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          backgroundColor: filter === tab.key ? tab.color : 'rgba(0,0,0,0.05)',
                          color: filter === tab.key ? 'white' : '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: filter === tab.key ? `0 4px 15px ${tab.color}40` : 'none'
                        }}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span style={{
                            backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.25)' : tab.color,
                            color: filter === tab.key ? 'white' : 'white',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedTable && (
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: 'white',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        🎯 Table {tables.find(t => t.id === selectedTable)?.label}
                      </div>
                      <button
                        onClick={() => setSelectedTable(null)}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '4px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {getFilteredRequests().length === 0 ? (
                    <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '64px', marginBottom: '20px' }}>
                        {selectedTable ? '🎯' : filter === 'pending' ? '⏳' : filter === 'in_progress' ? '🔄' : filter === 'completed' ? '🎉' : '✨'}
                      </div>
                      <h3 style={{
                        fontSize: '24px',
                        fontWeight: '600',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        margin: '0 0 12px 0'
                      }}>
                        {selectedTable 
                          ? `No requests for Table ${tables.find(t => t.id === selectedTable)?.label}`
                          : filter === 'all' ? 'All Clear! ✨' : `No ${filter.replace('_', ' ')} requests`
                        }
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '16px', margin: 0 }}>
                        {filter === 'all' ? 'When customers make requests, they\'ll appear here!' : 'Great job staying on top of things!'}
                      </p>
                    </div>
                  ) : (
                    getFilteredRequests().map((request, index) => {
                      const config = requestConfig[request.type as keyof typeof requestConfig]
                      const statusStyle = statusConfig[request.status as keyof typeof statusConfig]
                      
                      return (
                        <div
                          key={request.id}
                          className="request-card"
                          style={{
                            padding: '24px 32px',
                            borderBottom: index < getFilteredRequests().length - 1 ? '2px solid #f8fafc' : 'none',
                            background: config?.bgColor || '#f9fafb',
                            animation: `slideIn 0.5s ease-out ${index * 0.1}s both`
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '20px'
                          }}>
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px',
                                flexWrap: 'wrap' as const
                              }}>
                                <div style={{
                                  backgroundColor: config?.color || '#6b7280',
                                  color: 'white',
                                  padding: '10px',
                                  borderRadius: '12px',
                                  fontSize: '18px',
                                  boxShadow: `0 4px 15px ${config?.color || '#6b7280'}40`
                                }}>
                                  {config?.icon || '📋'}
                                </div>
                                
                                <div style={{
                                  fontSize: '18px',
                                  fontWeight: '600',
                                  color: '#1f2937'
                                }}>
                                  {config?.label || request.type}
                                </div>
                                
                                <div style={{
                                  padding: '6px 12px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  backgroundColor: statusStyle.color,
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: `0 4px 15px ${statusStyle.color}40`
                                }}>
                                  {statusStyle.icon} {statusStyle.label}
                                </div>
                                
                                {config?.priority === 'high' && request.status === 'pending' && (
                                  <div style={{
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: 'white',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase' as const,
                                    animation: 'pulse 2s infinite',
                                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                                  }}>
                                    🚨 URGENT
                                  </div>
                                )}

                                {request.photo_url && (
                                  <button
                                    onClick={() => setSelectedPhoto(request.photo_url)}
                                    style={{
                                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '10px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.05)'
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)'
                                    }}
                                  >
                                    📸 Photo
                                  </button>
                                )}
                              </div>
                              
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                fontSize: '14px',
                                color: '#6b7280',
                                marginBottom: '8px',
                                fontWeight: '500'
                              }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  🏪 {request.tables.restaurants.name}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  📍 Table {request.tables.label}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ⏰ {getTimeAgo(request.created_at)}
                                </span>
                              </div>
                            </div>

                            {/* Enhanced Action Buttons */}
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              flexShrink: 0,
                              flexWrap: 'wrap' as const
                            }}>
                              {request.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => updateRequestStatus(request.id, 'in_progress')}
                                    style={{
                                      padding: '10px 16px',
                                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '12px',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.05)'
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)'
                                    }}
                                  >
                                    🔄 Start
                                  </button>
                                  <button
                                    onClick={() => updateRequestStatus(request.id, 'completed')}
                                    style={{
                                      padding: '10px 16px',
                                      background: 'linear-gradient(135deg, #10b981, #059669)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '12px',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.05)'
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)'
                                    }}
                                  >
                                    ✅ Done
                                  </button>
                                </>
                              )}
                              
                              {request.status === 'in_progress' && (
                                <button
                                  onClick={() => updateRequestStatus(request.id, 'completed')}
                                  style={{
                                    padding: '10px 16px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)'
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)'
                                  }}
                                >
                                  ✅ Complete
                                </button>
                              )}
                              
                              {request.status === 'completed' && (
                                <button
                                  onClick={() => updateRequestStatus(request.id, 'pending')}
                                  style={{
                                    padding: '10px 16px',
                                    background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 15px rgba(107, 114, 128, 0.4)'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)'
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)'
                                  }}
                                >
                                  🔄 Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Enhanced Restaurant Layout View */}
            {(viewMode === 'split' || viewMode === 'layout') && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '24px 32px',
                  borderBottom: '2px solid #f8fafc',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)'
                }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: '22px',
                    fontWeight: '600',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span>🗺️</span>
                    Restaurant Layout
                    {selectedTable && (
                      <span style={{
                        fontSize: '14px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontWeight: '500'
                      }}>
                        Table {tables.find(t => t.id === selectedTable)?.label}
                      </span>
                    )}
                  </h2>
                </div>

                {/* Layout Area */}
                <div style={{
                  padding: '32px',
                  minHeight: '500px',
                  position: 'relative',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
                }}>
                  {/* Enhanced Legend */}
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    border: '2px solid rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    zIndex: 10,
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{ fontWeight: '700', marginBottom: '12px', color: '#374151', fontSize: '14px' }}>
                      🎯 Table Status
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                        }}></div>
                        <span style={{ color: '#374151', fontWeight: '500' }}>All Good</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                        }}></div>
                        <span style={{ color: '#374151', fontWeight: '500' }}>Needs Attention</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                          animation: 'pulse 2s infinite'
                        }}></div>
                        <span style={{ color: '#374151', fontWeight: '500' }}>URGENT!</span>
                      </div>
                    </div>
                  </div>

                  {/* Kitchen/Bar Area */}
                  <div style={{
                    position: 'absolute',
                    top: '32px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '240px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: 'white',
                    boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)'
                  }}>
                    👨‍🍳 Kitchen & Bar
                  </div>

                  {/* Tables */}
                  {tables.map((table, index) => (
                    <div
                      key={table.id}
                      className={`table-circle ${table.status}`}
                      onClick={() => setSelectedTable(selectedTable === table.id ? null : table.id)}
                      style={{
                        position: 'absolute',
                        left: `${table.x_position}px`,
                        top: `${table.y_position + 140}px`,
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: selectedTable === table.id 
                          ? 'linear-gradient(135deg, #667eea, #764ba2)'
                          : table.status === 'urgent'
                            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                            : table.status === 'pending'
                              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                              : 'linear-gradient(135deg, #10b981, #059669)',
                        border: `3px solid ${selectedTable === table.id ? '#4c51bf' : 'white'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: '700',
                        color: 'white',
                        boxShadow: selectedTable === table.id 
                          ? '0 0 0 4px rgba(102, 126, 234, 0.3), 0 10px 25px rgba(0,0,0,0.2)' 
                          : `0 8px 20px ${getTableColor(table)}40`,
                        animation: `slideIn 0.6s ease-out ${index * 0.1}s both`,
                        zIndex: selectedTable === table.id ? 5 : 1
                      }}
                    >
                      {table.label}
                      
                      {/* Enhanced Active requests indicator */}
                      {table.activeRequests.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '28px',
                          height: '28px',
                          background: table.status === 'urgent' 
                            ? 'linear-gradient(135deg, #dc2626, #b91c1c)' 
                            : 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: 'white',
                          borderRadius: '50%',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '3px solid white',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          animation: table.status === 'urgent' ? 'pulse 1.5s infinite' : 'none'
                        }}>
                          {table.activeRequests.length}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Entrance */}
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '160px',
                    height: '50px',
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: 'white',
                    boxShadow: '0 8px 20px rgba(6, 182, 212, 0.4)'
                  }}>
                    🚪 Main Entrance
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🗑️</div>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              margin: '0 0 12px 0',
              color: '#1f2937'
            }}>
              Clear All Requests?
            </h3>
            <p style={{ 
              color: '#6b7280', 
              margin: '0 0 24px 0',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              This will permanently delete all requests from the system. This action cannot be undone.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={resetAllRequests}
                disabled={resetting}
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  opacity: resetting ? 0.7 : 1,
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                }}
              >
                {resetting ? '🔄 Clearing...' : '🗑️ Yes, Clear All'}
              </button>
              
              <button
                onClick={() => setShowResetModal(false)}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#374151',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Photo Modal */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            backgroundColor: 'white',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>
                  🚽 Restroom Issue Photo
                </h3>
                <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                  Evidence provided by customer
                </p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              minHeight: '300px'
            }}>
              <img 
                src={selectedPhoto} 
                alt="Issue reported by customer" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}