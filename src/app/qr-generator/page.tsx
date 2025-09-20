'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Restaurant {
  id: string
  name: string
  slug: string
}

interface Table {
  id: string
  label: string
  restaurant_id: string
}

export default function QRGeneratorPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPrintView, setShowPrintView] = useState(false)

  useEffect(() => {
    setBaseUrl(window.location.origin)
    fetchRestaurants()
  }, [])

  useEffect(() => {
    if (selectedRestaurant) {
      fetchTables(selectedRestaurant.id)
    }
  }, [selectedRestaurant])

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('name')

      if (error) throw error
      setRestaurants(data || [])
    } catch (error) {
      console.error('Error fetching restaurants:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTables = async (restaurantId: string) => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('label')

      if (error) throw error
      setTables(data || [])
      setSelectedTables([])
    } catch (error) {
      console.error('Error fetching tables:', error)
    }
  }

  const toggleTable = (tableId: string) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    )
  }

  const selectAllTables = () => {
    setSelectedTables(tables.map(table => table.id))
  }

  const clearSelection = () => {
    setSelectedTables([])
  }

  const generateQRUrl = (restaurantSlug: string, tableLabel: string) => {
    return `${baseUrl}/u/${restaurantSlug}/${tableLabel}`
  }

  const getQRCodeUrl = (url: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
  }

  const getSelectedTablesData = () => {
    return tables.filter(table => selectedTables.includes(table.id))
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
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
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
            Loading QR Generator
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
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
          animation: fadeIn 0.6s ease-out;
        }
        
        .table-card {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .table-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 15px 35px rgba(102, 126, 234, 0.3);
        }
        
        .table-card.selected {
          border-color: #667eea;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }
        
        .qr-print-item {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print-area, .print-area * {
            visibility: visible;
          }
          
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          .no-print {
            display: none;
          }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: showPrintView ? 'white' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: showPrintView ? '20px' : '24px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          {!showPrintView ? (
            <>
              {/* Header */}
              <div className="fade-in" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '40px 32px',
                marginBottom: '32px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    padding: '16px',
                    borderRadius: '20px',
                    fontSize: '32px'
                  }}>
                    📱
                  </div>
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
                      QR Code Generator
                    </h1>
                    <p style={{
                      color: '#6b7280',
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '500'
                    }}>
                      Create printable QR codes for your restaurant tables
                    </p>
                  </div>
                </div>
                
                {baseUrl && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                      🌐 Your Restaurant System:
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}>
                      {baseUrl}
                    </div>
                  </div>
                )}
              </div>

              {/* Restaurant Selection */}
              <div className="fade-in" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '32px',
                marginBottom: '32px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  margin: '0 0 24px 0',
                  color: '#1f2937'
                }}>
                  1️⃣ Select Restaurant
                </h2>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '20px'
                }}>
                  {restaurants.map((restaurant, index) => (
                    <div
                      key={restaurant.id}
                      onClick={() => setSelectedRestaurant(restaurant)}
                      className="table-card"
                      style={{
                        padding: '24px',
                        borderRadius: '20px',
                        border: selectedRestaurant?.id === restaurant.id ? '3px solid #667eea' : '2px solid #e5e7eb',
                        backgroundColor: selectedRestaurant?.id === restaurant.id ? '#eff6ff' : 'white',
                        animation: `fadeIn 0.6s ease-out ${index * 0.1}s both`
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        <div style={{
                          backgroundColor: selectedRestaurant?.id === restaurant.id ? '#667eea' : '#f3f4f6',
                          color: selectedRestaurant?.id === restaurant.id ? 'white' : '#6b7280',
                          width: '50px',
                          height: '50px',
                          borderRadius: '15px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          boxShadow: selectedRestaurant?.id === restaurant.id ? '0 8px 25px rgba(102, 126, 234, 0.4)' : 'none'
                        }}>
                          🏪
                        </div>
                        <div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#1f2937',
                            marginBottom: '4px'
                          }}>
                            {restaurant.name}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            fontFamily: 'monospace',
                            backgroundColor: '#f8fafc',
                            padding: '4px 8px',
                            borderRadius: '6px'
                          }}>
                            /{restaurant.slug}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Selection */}
              {selectedRestaurant && (
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '24px',
                  padding: '32px',
                  marginBottom: '32px',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  animation: 'fadeIn 0.6s ease-out'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <h2 style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      margin: 0,
                      color: '#1f2937'
                    }}>
                      2️⃣ Select Tables ({selectedTables.length}/{tables.length})
                    </h2>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={selectAllTables}
                        style={{
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                        }}
                      >
                        ✅ Select All
                      </button>
                      <button
                        onClick={clearSelection}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        🗑️ Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '20px'
                  }}>
                    {tables.map((table, index) => (
                      <div
                        key={table.id}
                        onClick={() => toggleTable(table.id)}
                        className={`table-card ${selectedTables.includes(table.id) ? 'selected' : ''}`}
                        style={{
                          padding: '20px',
                          borderRadius: '16px',
                          border: selectedTables.includes(table.id) ? '3px solid #667eea' : '2px solid #e5e7eb',
                          backgroundColor: selectedTables.includes(table.id) ? '#eff6ff' : 'white',
                          animation: `fadeIn 0.4s ease-out ${index * 0.05}s both`,
                          textAlign: 'center'
                        }}
                      >
                        <div style={{
                          fontSize: '32px',
                          marginBottom: '12px'
                        }}>
                          {selectedTables.includes(table.id) ? '✅' : '📍'}
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: '#1f2937'
                        }}>
                          Table {table.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              {selectedTables.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '24px',
                  padding: '40px',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textAlign: 'center',
                  animation: 'fadeIn 0.6s ease-out'
                }}>
                  <button
                    onClick={() => setShowPrintView(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '20px 40px',
                      fontSize: '20px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 12px 25px rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      margin: '0 auto'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)'
                      e.currentTarget.style.boxShadow = '0 20px 40px rgba(16, 185, 129, 0.6)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)'
                      e.currentTarget.style.boxShadow = '0 12px 25px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    🎨 Generate QR Codes ({selectedTables.length})
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Print View */
            <div className="print-area">
              <div className="no-print" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px',
                padding: '24px',
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                border: '2px solid #e2e8f0'
              }}>
                <div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                    🖨️ Ready to Print!
                  </h2>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '16px' }}>
                    {getSelectedTablesData().length} QR codes for {selectedRestaurant?.name}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() => window.print()}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    🖨️ Print QR Codes
                  </button>
                  <button
                    onClick={() => setShowPrintView(false)}
                    style={{
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Generator
                  </button>
                </div>
              </div>

              {/* QR Codes Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '30px',
                marginBottom: '40px'
              }}>
                {getSelectedTablesData().map((table) => {
                  const url = generateQRUrl(selectedRestaurant!.slug, table.label)
                  const qrUrl = getQRCodeUrl(url)
                  
                  return (
                    <div
                      key={table.id}
                      className="qr-print-item"
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '20px',
                        padding: '32px',
                        textAlign: 'center',
                        border: '2px solid #e5e7eb',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{
                        backgroundColor: '#f8fafc',
                        padding: '24px',
                        borderRadius: '16px',
                        marginBottom: '20px'
                      }}>
                        <img
                          src={qrUrl}
                          alt={`QR Code for Table ${table.label}`}
                          style={{
                            width: '200px',
                            height: '200px',
                            display: 'block',
                            margin: '0 auto'
                          }}
                        />
                      </div>
                      
                      <h3 style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        margin: '0 0 8px 0',
                        color: '#1f2937'
                      }}>
                        {selectedRestaurant?.name}
                      </h3>
                      
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '16px'
                      }}>
                        Table {table.label}
                      </div>
                      
                      <div style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        marginBottom: '20px',
                        lineHeight: '1.5',
                        fontWeight: '500'
                      }}>
                        📱 Scan to make requests:<br />
                        • Clean table • Order food • Request sauces<br />
                        • Report issues • Get assistance
                      </div>
                      
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        backgroundColor: '#f9fafb',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        {url}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}