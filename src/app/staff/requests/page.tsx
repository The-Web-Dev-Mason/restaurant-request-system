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
    color: '#3b82f6',
    bgColor: '#eff6ff',
    priority: 'medium'
  },
  'toilet_clean': { 
    icon: '🚽', 
    label: 'Restroom Issue',
    color: '#ef4444',
    bgColor: '#fef2f2',
    priority: 'high'
  },
  'ready_to_order': { 
    icon: '🍽️', 
    label: 'Ready to Order',
    color: '#10b981',
    bgColor: '#ecfdf5',
    priority: 'high'
  },
  'additional_order': { 
    icon: '➕', 
    label: 'Additional Order',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    priority: 'medium'
  },
  'replace_cutlery': { 
    icon: '🍴', 
    label: 'Cutlery Request',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    priority: 'low'
  },
  'request_sauces': { 
    icon: '🥫', 
    label: 'Condiments',
    color: '#06b6d4',
    bgColor: '#ecfeff',
    priority: 'low'
  }
}

const statusConfig = {
  'pending': { 
    color: '#f59e0b', 
    bg: '#fffbeb', 
    border: '#fed7aa',
    icon: '⏳',
    label: 'Pending'
  },
  'in_progress': { 
    color: '#3b82f6', 
    bg: '#eff6ff', 
    border: '#bfdbfe',
    icon: '🔄',
    label: 'In Progress'
  },
  'completed': { 
    color: '#10b981', 
    bg: '#ecfdf5', 
    border: '#a7f3d0',
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
      // Fetch requests with table positions
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

      // Fetch all tables with positions
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .order('label')

      if (tablesError) throw tablesError

      // Process tables with request counts
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
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
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
          boxShadow: '0 25px 50px rgba(0,0,0,0.08)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
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
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
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
        
        .request-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .request-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
        }
        
        .table-circle {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .table-circle:hover {
          transform: scale(1.1);
        }
        
        .table-circle.urgent {
          animation: urgentPulse 2s infinite;
        }
        
        .photo-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.3s ease-out;
        }
        
        .photo-container {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
        }
        
        .photo-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .close-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s ease;
        }
        
        .close-button:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px'
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '32px',
            marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
            border: '1px solid rgba(226,232,240,0.8)'
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
                  fontSize: '32px', 
                  fontWeight: '700', 
                  margin: '0 0 8px 0', 
                  background: 'linear-gradient(135deg, #1f2937, #4b5563)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Staff Dashboard
                </h1>
                <p style={{ 
                  color: '#6b7280', 
                  margin: 0, 
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>🔴 Live</span>
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
              
              {/* View Mode Toggle */}
              <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: '#f1f5f9',
                padding: '4px',
                borderRadius: '12px'
              }}>
                {[
                  { key: 'split', label: '📊 Split View', icon: '📊' },
                  { key: 'list', label: '📋 List Only', icon: '📋' },
                  { key: 'layout', label: '🗺️ Layout Only', icon: '🗺️' }
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setViewMode(mode.key as any)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: viewMode === mode.key ? '#3b82f6' : 'transparent',
                      color: viewMode === mode.key ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {mode.icon}
                  </button>
                ))}
              </div>

              {stats.urgent > 0 && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid #fecaca',
                  animation: 'pulse 2s infinite'
                }}>
                  🚨 {stats.urgent} Urgent Request{stats.urgent !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {[
              { label: 'Urgent', count: stats.urgent, color: '#ef4444', bg: '#fef2f2', icon: '🚨' },
              { label: 'Pending', count: stats.pending, color: '#f59e0b', bg: '#fffbeb', icon: '⏳' },
              { label: 'In Progress', count: stats.inProgress, color: '#3b82f6', bg: '#eff6ff', icon: '🔄' },
              { label: 'Completed', count: stats.completed, color: '#10b981', bg: '#ecfdf5', icon: '✅' },
              { label: 'Total', count: stats.total, color: '#6b7280', bg: '#f9fafb', icon: '📊' }
            ].map((stat, index) => (
              <div key={stat.label} style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
                border: '1px solid rgba(226,232,240,0.8)',
                animation: `slideIn 0.6s ease-out ${index * 0.1}s both`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: stat.color
                  }}>
                    {stat.count}
                  </div>
                  <div style={{
                    fontSize: '20px',
                    backgroundColor: stat.bg,
                    padding: '6px',
                    borderRadius: '10px'
                  }}>
                    {stat.icon}
                  </div>
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.5px'
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
                backgroundColor: 'white',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
                border: '1px solid rgba(226,232,240,0.8)',
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
                      { key: 'all', label: 'All', count: stats.total },
                      { key: 'pending', label: 'Pending', count: stats.pending },
                      { key: 'in_progress', label: 'In Progress', count: stats.inProgress },
                      { key: 'completed', label: 'Completed', count: stats.completed }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          border: 'none',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          backgroundColor: filter === tab.key ? '#3b82f6' : '#f8fafc',
                          color: filter === tab.key ? 'white' : '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span style={{
                            backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                            color: filter === tab.key ? 'white' : '#374151',
                            padding: '2px 6px',
                            borderRadius: '6px',
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
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#0369a1',
                        fontWeight: '600'
                      }}>
                        🎯 Filtered by: Table {tables.find(t => t.id === selectedTable)?.label}
                      </div>
                      <button
                        onClick={() => setSelectedTable(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0369a1',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '4px'
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
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                        {selectedTable ? '🎯' : filter === 'pending' ? '⏳' : filter === 'in_progress' ? '🔄' : filter === 'completed' ? '🎉' : '📋'}
                      </div>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#374151',
                        margin: '0 0 8px 0'
                      }}>
                        {selectedTable 
                          ? `No ${filter === 'all' ? '' : filter + ' '}requests for this table`
                          : filter === 'all' ? 'No requests yet' : `No ${filter.replace('_', ' ')} requests`
                        }
                      </h3>
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
                            padding: '20px 32px',
                            borderBottom: index < getFilteredRequests().length - 1 ? '1px solid #f3f4f6' : 'none',
                            animation: `slideIn 0.4s ease-out ${index * 0.05}s both`
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '16px'
                          }}>
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '10px',
                                flexWrap: 'wrap' as const
                              }}>
                                <div style={{
                                  backgroundColor: config?.bgColor || '#f3f4f6',
                                  padding: '6px',
                                  borderRadius: '10px',
                                  fontSize: '16px'
                                }}>
                                  {config?.icon || '📋'}
                                </div>
                                
                                <div style={{
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  color: '#1f2937'
                                }}>
                                  {config?.label || request.type}
                                </div>
                                
                                <div style={{
                                  padding: '4px 10px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: statusStyle.bg,
                                  color: statusStyle.color,
                                  border: `1px solid ${statusStyle.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  {statusStyle.icon} {statusStyle.label}
                                </div>
                                
                                {config?.priority === 'high' && request.status === 'pending' && (
                                  <div style={{
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    padding: '3px 6px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase' as const,
                                    animation: 'pulse 2s infinite'
                                  }}>
                                    URGENT
                                  </div>
                                )}

                                {request.photo_url && (
                                  <button
                                    onClick={() => setSelectedPhoto(request.photo_url)}
                                    style={{
                                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                  >
                                    📸
                                  </button>
                                )}
                              </div>
                              
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '13px',
                                color: '#6b7280',
                                marginBottom: '6px'
                              }}>
                                <span>🏪 {request.tables.restaurants.name}</span>
                                <span>📍 Table {request.tables.label}</span>
                                <span>⏰ {getTimeAgo(request.created_at)}</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{
                              display: 'flex',
                              gap: '6px',
                              flexShrink: 0,
                              flexWrap: 'wrap' as const
                            }}>
                              {request.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => updateRequestStatus(request.id, 'in_progress')}
                                    style={{
                                      padding: '8px 12px',
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    🔄 Start
                                  </button>
                                  <button
                                    onClick={() => updateRequestStatus(request.id, 'completed')}
                                    style={{
                                      padding: '8px 12px',
                                      backgroundColor: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer'
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
                                    padding: '8px 12px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✅ Complete
                                </button>
                              )}
                              
                              {request.status === 'completed' && (
                                <button
                                  onClick={() => updateRequestStatus(request.id, 'pending')}
                                  style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
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

            {/* Restaurant Layout View */}
            {(viewMode === 'split' || viewMode === 'layout') && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
                border: '1px solid rgba(226,232,240,0.8)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '24px 32px',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb'
                }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span>🗺️</span>
                    Restaurant Layout
                    {selectedTable && (
                      <span style={{
                        fontSize: '14px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontWeight: '500'
                      }}>
                        Table {tables.find(t => t.id === selectedTable)?.label} Selected
                      </span>
                    )}
                  </h2>
                </div>

                {/* Layout Area */}
                <div style={{
                  padding: '32px',
                  minHeight: '500px',
                  position: 'relative',
                  backgroundColor: '#fafbfc'
                }}>
                  {/* Legend */}
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    backgroundColor: 'white',
                    padding: '16px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                    zIndex: 10
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                      Table Status
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981'
                        }}></div>
                        <span style={{ color: '#6b7280' }}>No requests</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#f59e0b'
                        }}></div>
                        <span style={{ color: '#6b7280' }}>Pending request</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444'
                        }}></div>
                        <span style={{ color: '#6b7280' }}>Urgent</span>
                      </div>
                    </div>
                  </div>

                  {/* Kitchen/Bar Area (Example) */}
                  <div style={{
                    position: 'absolute',
                    top: '32px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '200px',
                    height: '80px',
                    backgroundColor: '#f3f4f6',
                    border: '2px dashed #9ca3af',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6b7280'
                  }}>
                    🍳 Kitchen / Bar
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
                        top: `${table.y_position + 120}px`, // Offset for kitchen area
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: getTableBgColor(table),
                        border: `3px solid ${getTableColor(table)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: '700',
                        color: getTableColor(table),
                        boxShadow: selectedTable === table.id 
                          ? `0 0 0 4px ${getTableColor(table)}40` 
                          : '0 4px 8px rgba(0,0,0,0.1)',
                        animation: `slideIn 0.6s ease-out ${index * 0.1}s both`,
                        zIndex: selectedTable === table.id ? 5 : 1
                      }}
                    >
                      {table.label}
                      
                      {/* Active requests indicator */}
                      {table.activeRequests.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          width: '20px',
                          height: '20px',
                          backgroundColor: table.status === 'urgent' ? '#dc2626' : '#f59e0b',
                          color: 'white',
                          borderRadius: '50%',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
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
                    width: '120px',
                    height: '40px',
                    backgroundColor: '#e0f2fe',
                    border: '2px solid #0891b2',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#0891b2'
                  }}>
                    🚪 Entrance
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="photo-container" onClick={(e) => e.stopPropagation()}>
            <div className="photo-header">
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>
                  🚽 Restroom Issue Photo
                </h3>
                <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                  Pinch to zoom • Click outside to close
                </p>
              </div>
              <button
                className="close-button"
                onClick={() => setSelectedPhoto(null)}
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
              minHeight: '200px'
            }}>
              <img 
                src={selectedPhoto} 
                alt="Issue reported by customer" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}