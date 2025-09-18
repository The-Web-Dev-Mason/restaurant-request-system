'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, type RequestType } from '@/lib/supabase'

interface PageProps {
  params: {
    restaurantSlug: string
    tableLabel: string
  }
}

const cooldownSettings = {
  'toilet_clean': 15,
  'ready_to_order': 10,
  'table_clean': 10,
  'additional_order': 5,
  'replace_cutlery': 5,
  'request_sauces': 3
}

const requestOptions = [
  { 
    type: 'table_clean' as RequestType, 
    icon: '🧽', 
    label: 'Clean Table', 
    description: 'Table needs cleaning',
    requiresPhoto: false,
    priority: 'medium'
  },
  { 
    type: 'toilet_clean' as RequestType, 
    icon: '🚽', 
    label: 'Toilet Issue', 
    description: 'Report restroom problem',
    requiresPhoto: true,
    priority: 'high'
  },
  { 
    type: 'ready_to_order' as RequestType, 
    icon: '🍽️', 
    label: 'Ready to Order', 
    description: 'Ready to place order',
    requiresPhoto: false,
    priority: 'high'
  },
  { 
    type: 'additional_order' as RequestType, 
    icon: '➕', 
    label: 'Order More', 
    description: 'Additional items',
    requiresPhoto: false,
    priority: 'medium'
  },
  { 
    type: 'replace_cutlery' as RequestType, 
    icon: '🍴', 
    label: 'New Cutlery', 
    description: 'Fresh utensils needed',
    requiresPhoto: false,
    priority: 'low'
  },
  { 
    type: 'request_sauces' as RequestType, 
    icon: '🥫', 
    label: 'Sauces', 
    description: 'Condiments needed',
    requiresPhoto: false,
    priority: 'low'
  },
]

export default function CustomerPage({ params }: PageProps) {
  const [restaurant, setRestaurant] = useState<any>(null)
  const [table, setTable] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState<RequestType | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cooldowns, setCooldowns] = useState<Record<RequestType, { until: Date | null, timeLeft: string }>>({} as any)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchRestaurantAndTable()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      updateCooldownTimers()
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldowns])

  const fetchRestaurantAndTable = async () => {
    try {
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', params.restaurantSlug)
        .single()

      if (restaurantError) throw new Error('Restaurant not found')
      setRestaurant(restaurantData)

      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .eq('label', params.tableLabel)
        .single()

      if (tableError) throw new Error('Table not found')
      setTable(tableData)

      await checkCooldowns(tableData.id)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const checkCooldowns = async (tableId: string) => {
    const newCooldowns = {} as Record<RequestType, { until: Date | null, timeLeft: string }>

    for (const option of requestOptions) {
      const { data: lastRequest } = await supabase
        .from('requests')
        .select('created_at')
        .eq('table_id', tableId)
        .eq('type', option.type)
        .order('created_at', { ascending: false })
        .limit(1)

      if (lastRequest && lastRequest.length > 0) {
        const lastRequestTime = new Date(lastRequest[0].created_at)
        const cooldownMinutes = cooldownSettings[option.type]
        const cooldownUntil = new Date(lastRequestTime.getTime() + cooldownMinutes * 60 * 1000)
        const now = new Date()

        if (now < cooldownUntil) {
          newCooldowns[option.type] = {
            until: cooldownUntil,
            timeLeft: getTimeUntil(cooldownUntil)
          }
        } else {
          newCooldowns[option.type] = { until: null, timeLeft: '' }
        }
      } else {
        newCooldowns[option.type] = { until: null, timeLeft: '' }
      }
    }

    setCooldowns(newCooldowns)
  }

  const updateCooldownTimers = () => {
    setCooldowns(prev => {
      const updated = { ...prev }
      let hasChanges = false

      for (const type of Object.keys(updated) as RequestType[]) {
        if (updated[type].until) {
          const timeLeft = getTimeUntil(updated[type].until!)
          if (timeLeft !== updated[type].timeLeft) {
            updated[type] = { ...updated[type], timeLeft }
            hasChanges = true

            if (timeLeft === '') {
              updated[type] = { until: null, timeLeft: '' }
            }
          }
        }
      }

      return hasChanges ? updated : prev
    })
  }

  const getTimeUntil = (until: Date): string => {
    const now = new Date()
    const diff = until.getTime() - now.getTime()

    if (diff <= 0) return ''

    const minutes = Math.floor(diff / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `toilet-${Date.now()}.${fileExt}`
    const filePath = `toilet-photos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const submitRequest = async (requestType: RequestType) => {
    if (!table) return

    if (cooldowns[requestType]?.until) {
      setMessage(`⏳ Please wait ${cooldowns[requestType].timeLeft} before making this request again.`)
      setTimeout(() => setMessage(''), 4000)
      return
    }

    const option = requestOptions.find(opt => opt.type === requestType)
    
    if (option?.requiresPhoto && !photoFile) {
      setShowPhotoModal(true)
      return
    }

    setSubmitting(requestType)
    setMessage('')

    try {
      let photoUrl = null
      
      if (photoFile && option?.requiresPhoto) {
        photoUrl = await uploadPhoto(photoFile)
      }

      const { error } = await supabase
        .from('requests')
        .insert({
          table_id: table.id,
          type: requestType,
          photo_url: photoUrl
        })

      if (error) throw error

      setMessage('✅ Request sent! Our staff will assist you shortly.')
      setShowPhotoModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)

      const cooldownMinutes = cooldownSettings[requestType]
      const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000)
      setCooldowns(prev => ({
        ...prev,
        [requestType]: { until: cooldownUntil, timeLeft: getTimeUntil(cooldownUntil) }
      }))
      
      setTimeout(() => setMessage(''), 4000)

    } catch (error: any) {
      setMessage(`❌ ${error.message}`)
    } finally {
      setSubmitting(null)
    }
  }

  const closePhotoModal = () => {
    setShowPhotoModal(false)
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const isOnCooldown = (requestType: RequestType): boolean => {
    return Boolean(cooldowns[requestType]?.until)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#64748b'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ fontSize: '16px', margin: 0 }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!restaurant || !table) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😅</div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1f2937' }}>Not Found</h2>
          <p style={{ color: '#64748b', margin: 0 }}>Restaurant or table not found.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .request-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .request-card:hover:not(.disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .request-card:active:not(.disabled) {
          transform: translateY(0);
        }
        
        .request-card.disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .photo-modal {
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
          animation: fadeIn 0.2s ease-out;
        }
        
        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: '20px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px 24px',
            textAlign: 'center',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            animation: 'slideUp 0.5s ease-out'
          }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              margin: '0 0 8px 0',
              color: '#1f2937',
              letterSpacing: '-0.025em'
            }}>
              {restaurant.name}
            </h1>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Table {table.label}
            </div>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div style={{
              backgroundColor: message.includes('✅') 
                ? '#f0f9ff' 
                : message.includes('⏳') 
                  ? '#fefce8'
                  : '#fef2f2',
              color: message.includes('✅') 
                ? '#0c4a6e' 
                : message.includes('⏳') 
                  ? '#713f12'
                  : '#991b1b',
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '24px',
              textAlign: 'center',
              fontSize: '15px',
              fontWeight: '500',
              border: `1px solid ${
                message.includes('✅') 
                  ? '#bae6fd' 
                  : message.includes('⏳') 
                    ? '#fde68a'
                    : '#fecaca'
              }`,
              animation: 'slideUp 0.4s ease-out'
            }}>
              {message}
            </div>
          )}

          {/* Request Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {requestOptions.map((option, index) => {
              const onCooldown = isOnCooldown(option.type)
              const isSubmittingThis = submitting === option.type
              const isDisabled = onCooldown || isSubmittingThis
              
              return (
                <div
                  key={option.type}
                  onClick={() => !isDisabled && submitRequest(option.type)}
                  className={`request-card ${isDisabled ? 'disabled' : ''}`}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: `2px solid ${isDisabled ? '#e2e8f0' : '#f1f5f9'}`,
                    boxShadow: isDisabled ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                    animation: `slideUp 0.6s ease-out ${index * 0.1}s both`,
                    textAlign: 'center'
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    fontSize: '36px',
                    marginBottom: '16px',
                    filter: isDisabled ? 'grayscale(100%)' : 'none'
                  }}>
                    {isSubmittingThis ? '⏳' : onCooldown ? '🕒' : option.icon}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    margin: '0 0 8px 0',
                    color: isDisabled ? '#9ca3af' : '#1f2937'
                  }}>
                    {isSubmittingThis 
                      ? 'Sending...' 
                      : onCooldown 
                        ? `Wait ${cooldowns[option.type]?.timeLeft}`
                        : option.label}
                  </h3>

                  {/* Description */}
                  <p style={{
                    fontSize: '14px',
                    color: isDisabled ? '#9ca3af' : '#64748b',
                    margin: '0 0 12px 0',
                    lineHeight: '1.4'
                  }}>
                    {onCooldown 
                      ? `${cooldownSettings[option.type]} min cooldown` 
                      : option.description}
                  </p>

                  {/* Priority/Photo indicator */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {option.priority === 'high' && !onCooldown && (
                      <span style={{
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Priority
                      </span>
                    )}
                    
                    {option.requiresPhoto && !onCooldown && (
                      <span style={{
                        backgroundColor: '#f0f9ff',
                        color: '#0369a1',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        📸 Photo Required
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: '0 0 4px 0',
              fontWeight: '500'
            }}>
              Need immediate help?
            </p>
            <p style={{
              fontSize: '13px',
              color: '#9ca3af',
              margin: 0
            }}>
              Please wave to our staff or visit the counter
            </p>
          </div>

        </div>
      </div>

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="photo-modal" onClick={closePhotoModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📸</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                margin: '0 0 8px 0',
                color: '#1f2937'
              }}>
                Photo Required
              </h3>
              <p style={{ 
                color: '#64748b', 
                margin: 0,
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                Take a photo of the issue so our staff can assist you better.
              </p>
            </div>

            {photoPreview && (
              <div style={{
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}
                />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />

            <div style={{
              display: 'flex',
              gap: '12px',
              flexDirection: 'column'
            }}>
              <button
                onClick={openCamera}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                📷 {photoFile ? 'Change Photo' : 'Take Photo'}
              </button>

              {photoFile && (
                <button
                  onClick={() => submitRequest('toilet_clean')}
                  disabled={submitting === 'toilet_clean'}
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: submitting === 'toilet_clean' ? 'not-allowed' : 'pointer',
                    opacity: submitting === 'toilet_clean' ? 0.7 : 1
                  }}
                >
                  {submitting === 'toilet_clean' ? '⏳ Sending...' : '✅ Send Request'}
                </button>
              )}

              <button
                onClick={closePhotoModal}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}