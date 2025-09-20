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
    description: 'Table needs cleaning & sanitizing',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    shadowColor: 'rgba(6, 182, 212, 0.4)',
    requiresPhoto: false,
    priority: 'medium'
  },
  { 
    type: 'toilet_clean' as RequestType, 
    icon: '🚽', 
    label: 'Toilet Issue', 
    description: 'Report restroom problem',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    shadowColor: 'rgba(239, 68, 68, 0.4)',
    requiresPhoto: true,
    priority: 'high'
  },
  { 
    type: 'ready_to_order' as RequestType, 
    icon: '🍽️', 
    label: 'Ready to Order', 
    description: 'Ready to place our order',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    requiresPhoto: false,
    priority: 'high'
  },
  { 
    type: 'additional_order' as RequestType, 
    icon: '➕', 
    label: 'Order More', 
    description: 'Want additional items',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    shadowColor: 'rgba(245, 158, 11, 0.4)',
    requiresPhoto: false,
    priority: 'medium'
  },
  { 
    type: 'replace_cutlery' as RequestType, 
    icon: '🍴', 
    label: 'New Cutlery', 
    description: 'Need fresh utensils',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    shadowColor: 'rgba(139, 92, 246, 0.4)',
    requiresPhoto: false,
    priority: 'low'
  },
  { 
    type: 'request_sauces' as RequestType, 
    icon: '🥫', 
    label: 'Sauces & Condiments', 
    description: 'Need seasonings or sauces',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    shadowColor: 'rgba(236, 72, 153, 0.4)',
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

      setMessage('✨ Request sent! Our staff will assist you shortly.')
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
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(102, 126, 234, 0.3)',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px'
          }}></div>
          <p style={{ fontSize: '18px', margin: 0, color: '#374151', fontWeight: '500' }}>
            ✨ Loading your experience...
          </p>
        </div>
      </div>
    )
  }

  if (!restaurant || !table) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          padding: '48px',
          borderRadius: '24px',
          textAlign: 'center',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>😅</div>
          <h2 style={{ fontSize: '24px', margin: '0 0 12px 0', color: '#374151' }}>Oops!</h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '16px' }}>
            We couldn't find this restaurant or table.
          </p>
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
            transform: translateY(30px);
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
        
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
          }
          50% { 
            transform: scale(1.05);
          }
        }
        
        @keyframes rainbow {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(102, 126, 234, 0.8), 0 0 60px rgba(118, 75, 162, 0.4);
          }
        }
        
        .request-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        
        .request-card:hover:not(.disabled) {
          transform: translateY(-8px) scale(1.02);
          animation: glow 2s ease-in-out infinite;
        }
        
        .request-card:active:not(.disabled) {
          transform: translateY(-4px) scale(1.01);
        }
        
        .request-card.disabled {
          cursor: not-allowed;
          opacity: 0.7;
          filter: grayscale(50%);
        }
        
        .request-card.disabled:hover {
          transform: none;
          animation: none;
        }
        
        .shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
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
          animation: fadeIn 0.3s ease-out;
        }
        
        .modal-content {
          background: white;
          border-radius: 24px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          animation: slideUp 0.4s ease-out;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Vibrant Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '40px 32px',
            textAlign: 'center',
            marginBottom: '32px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            animation: 'slideUp 0.8s ease-out',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div className="shimmer"></div>
            <h1 style={{
              fontSize: '36px',
              fontWeight: '700',
              margin: '0 0 16px 0',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px'
            }}>
              ✨ {restaurant.name}
            </h1>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '20px',
              fontSize: '18px',
              fontWeight: '600',
              boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
            }}>
              🎯 Table {table.label}
            </div>
          </div>

          {/* Enhanced Success/Error Message */}
          {message && (
            <div style={{
              background: message.includes('✨') 
                ? 'linear-gradient(135deg, #10b981, #059669)' 
                : message.includes('⏳') 
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              padding: '20px 24px',
              borderRadius: '16px',
              marginBottom: '32px',
              textAlign: 'center',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: message.includes('✨') 
                ? '0 12px 25px rgba(16, 185, 129, 0.4)'
                : message.includes('⏳') 
                  ? '0 12px 25px rgba(245, 158, 11, 0.4)'
                  : '0 12px 25px rgba(239, 68, 68, 0.4)',
              animation: 'slideUp 0.5s ease-out, pulse 2s infinite'
            }}>
              {message}
            </div>
          )}

          {/* Vibrant Request Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            marginBottom: '40px'
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
                    background: isDisabled 
                      ? 'rgba(255, 255, 255, 0.8)'
                      : `rgba(255, 255, 255, 0.95)`,
                    backdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    padding: '32px 24px',
                    border: isDisabled 
                      ? '2px solid rgba(156, 163, 175, 0.3)' 
                      : `2px solid rgba(255,255,255,0.3)`,
                    boxShadow: isDisabled 
                      ? 'none' 
                      : `0 15px 35px ${option.shadowColor}`,
                    animation: `slideUp 0.8s ease-out ${index * 0.1}s both`,
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {!isDisabled && <div className="shimmer"></div>}
                  
                  {/* Enhanced Icon */}
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '20px',
                    filter: isDisabled ? 'grayscale(100%)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    {isSubmittingThis ? (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid #e5e7eb',
                        borderTop: '4px solid #667eea',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto'
                      }}></div>
                    ) : onCooldown ? '🕒' : option.icon}
                  </div>

                  {/* Enhanced Title */}
                  <h3 style={{
                    fontSize: '22px',
                    fontWeight: '700',
                    margin: '0 0 12px 0',
                    color: isDisabled ? '#9ca3af' : '#1f2937',
                    letterSpacing: '-0.3px'
                  }}>
                    {isSubmittingThis 
                      ? '⏳ Sending Request...' 
                      : onCooldown 
                        ? `Wait ${cooldowns[option.type]?.timeLeft}`
                        : option.label}
                  </h3>

                  {/* Enhanced Description */}
                  <p style={{
                    fontSize: '15px',
                    color: isDisabled ? '#9ca3af' : '#64748b',
                    margin: '0 0 20px 0',
                    lineHeight: '1.5',
                    fontWeight: '500'
                  }}>
                    {onCooldown 
                      ? `Prevents spam • ${cooldownSettings[option.type]} min cooldown` 
                      : option.description}
                  </p>

                  {/* Enhanced Priority/Photo indicators */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    {option.priority === 'high' && !onCooldown && (
                      <span style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                        animation: 'pulse 2s infinite'
                      }}>
                        🚨 Priority
                      </span>
                    )}
                    
                    {option.requiresPhoto && !onCooldown && (
                      <span style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                      }}>
                        📸 Photo Required
                      </span>
                    )}
                  </div>

                  {/* Gradient overlay for non-disabled cards */}
                  {!isDisabled && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: option.gradient,
                      borderRadius: '0 0 22px 22px'
                    }}></div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Enhanced Footer */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '24px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
          }}>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: '0 0 8px 0',
              fontWeight: '600'
            }}>
              🔔 Need immediate help?
            </p>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              margin: 0,
              fontWeight: '500'
            }}>
              Please wave to our staff or visit the counter
            </p>
          </div>

        </div>
      </div>

      {/* Enhanced Photo Upload Modal */}
      {showPhotoModal && (
        <div className="photo-modal" onClick={closePhotoModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ 
                fontSize: '64px', 
                marginBottom: '16px',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>📸</div>
              <h3 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                margin: '0 0 8px 0',
                background: 'linear-gradient(135deg, #374151, #1f2937)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Photo Required
              </h3>
              <p style={{ 
                color: '#64748b', 
                margin: 0,
                fontSize: '16px',
                lineHeight: '1.5',
                fontWeight: '500'
              }}>
                Take a photo of the issue so our staff can assist you better.
              </p>
            </div>

            {photoPreview && (
              <div style={{
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
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
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.6)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)'
                }}
              >
                📷 {photoFile ? 'Change Photo' : 'Take Photo'}
              </button>

              {photoFile && (
                <button
                  onClick={() => submitRequest('toilet_clean')}
                  disabled={submitting === 'toilet_clean'}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '16px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: submitting === 'toilet_clean' ? 'not-allowed' : 'pointer',
                    opacity: submitting === 'toilet_clean' ? 0.7 : 1,
                    transition: 'all 0.3s ease',
                    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    if (submitting !== 'toilet_clean') {
                      e.currentTarget.style.transform = 'scale(1.05)'
                      e.currentTarget.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.6)'
                    }
                  }}
                  onMouseOut={(e) => {
                    if (submitting !== 'toilet_clean') {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)'
                    }
                  }}
                >
                  {submitting === 'toilet_clean' ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Sending...
                    </>
                  ) : (
                    <>✅ Send Request</>
                  )}
                </button>
              )}

              <button
                onClick={closePhotoModal}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9'
                  e.currentTarget.style.borderColor = '#cbd5e1'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.borderColor = '#e2e8f0'
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