"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

// Initial seed reviews for the discovery directory
const SEED_REVIEWS = [
  { id: 'rev-1', salonId: 'salon-classic', author: 'Clara Oswald', stylistName: 'Sarah Connor', rating: 5, text: 'Absolutely love my cut! Sarah did a perfect framing job. Clean shop and great music.' },
  { id: 'rev-2', salonId: 'salon-classic', author: 'Alex Mercer', stylistName: 'Marcus Vance', rating: 4, text: 'Great low fade taper. Very professional, Marcus knows what he is doing. Reference photos made the repeat visit super easy!' },
  { id: 'rev-3', salonId: 'salon-fade', author: 'Eric Cartman', stylistName: 'Leroy Jenkins', rating: 5, text: 'Awesome skin fade! Quick service and very crisp lines.' }
];

export default function DiscoveryPage() {
  const router = useRouter();
  const { salons, staff } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [reviews, setReviews] = useState(SEED_REVIEWS);

  // Write Review form states
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewStylist, setReviewStylist] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Sync reviews state with local storage to persist user inputs
  useEffect(() => {
    const stored = localStorage.getItem('snipmem_discovery_reviews');
    if (stored) {
      setReviews(JSON.parse(stored));
    }
  }, []);

  const saveReviews = (newReviews) => {
    setReviews(newReviews);
    localStorage.setItem('snipmem_discovery_reviews', JSON.stringify(newReviews));
  };

  // Filter salons matching search criteria
  const activeSalons = salons.filter(s => s.subscriptionStatus !== 'Cancelled');
  const filteredSalons = activeSalons.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get active staff for a specific salon
  const getSalonStaff = (salonId) => {
    return staff.filter(st => st.salonId === salonId);
  };

  // Get reviews for a specific salon
  const getSalonReviews = (salonId) => {
    return reviews.filter(r => r.salonId === salonId);
  };

  // Calculate average rating
  const getAverageRating = (salonId) => {
    const salonReviews = getSalonReviews(salonId);
    if (salonReviews.length === 0) return 4.5; // Default fallback
    const total = salonReviews.reduce((sum, r) => sum + r.rating, 0);
    return (total / salonReviews.length).toFixed(1);
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (!reviewAuthor.trim() || !reviewText.trim()) return;

    const newReview = {
      id: `rev-${Date.now()}`,
      salonId: selectedSalon.id,
      author: reviewAuthor.trim(),
      stylistName: reviewStylist || 'Any Stylist',
      rating: Number(reviewRating),
      text: reviewText.trim()
    };

    const updatedReviews = [newReview, ...reviews];
    saveReviews(updatedReviews);

    // Reset form
    setReviewAuthor('');
    setReviewStylist('');
    setReviewRating(5);
    setReviewText('');
    setFormSuccess(true);

    setTimeout(() => {
      setFormSuccess(false);
    }, 4000);
  };

  return (
    <div className="animate-fade" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      
      {/* Header */}
      <header className="marketing-header">
        <div className="container flex-between">
          <div className="logo-brand" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color: 'var(--accent-color)'}}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z"/>
            </svg>
            Snip<span>Memory</span>
          </div>
          <nav className="nav-links">
            <button className="btn btn-text btn-sm" onClick={() => router.push('/')}>Home</button>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/login')}>Salon Portal</button>
          </nav>
        </div>
      </header>

      {/* Hero Banner */}
      <section style={{ padding: '3.5rem 0 2rem 0', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', fontWeight: '800' }}>Discover Premium Local Salons</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: '0 0 1.5rem 0' }}>
            Find nearby shops using SnipMemory's 4-Angle Style database. Consistency, security, and elite results.
          </p>
          <div className="form-group" style={{ maxWidth: '500px', margin: '0 auto', position: 'relative' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search salon name, city, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', borderRadius: '50px' }}
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Salon Directory List */}
      <main className="container" style={{ padding: '3rem 1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          {filteredSalons.length} Matching Shops Available
        </h2>

        <div className="grid-3" style={{ gap: '1.5rem' }}>
          {filteredSalons.map(salon => {
            const avgRating = getAverageRating(salon.id);
            const totalReviews = getSalonReviews(salon.id).length;
            
            return (
              <div key={salon.id} className="card flex-column" style={{ justifyContent: 'space-between', height: '100%' }}>
                <div>
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <span className="badge badge-active" style={{ fontSize: '0.6875rem' }}>Verified Partner</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontSize: '0.875rem', fontWeight: '700' }}>
                      ★ <span>{avgRating}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.75rem' }}>({totalReviews})</span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: '700' }}>{salon.name}</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '2px', color: 'var(--accent-color)' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>{salon.address || 'Address unlisted'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success-color)' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      <span>{salon.mobileNumber}</span>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-secondary btn-block" 
                  onClick={() => setSelectedSalon(salon)}
                  style={{ marginTop: '1rem' }}
                >
                  View Details & Reviews
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* Salon Details & Reviews Overlay Modal */}
      {selectedSalon && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content animate-slide" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header info */}
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>{selectedSalon.name}</h2>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{selectedSalon.address}</span>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setSelectedSalon(null); setFormSuccess(false); }}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
              >
                Close
              </button>
            </div>

            {/* Salon Team Workspace Callout */}
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid var(--accent-color)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'block' }}>Salon Workspace Portal</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Access the private stylist camera station and analytics dashboard for {selectedSalon.name}.</span>
              </div>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => router.push(`/salon/${selectedSalon.id}/login`)}
                style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
              >
                Workspace Login &rarr;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              
              {/* Stylists roster */}
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: '700' }}>Active Stylist Team</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {getSalonStaff(selectedSalon.id).length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No staff listed</span>
                  ) : (
                    getSalonStaff(selectedSalon.id).map(st => (
                      <span key={st.id} className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-color)', padding: '0.4rem 0.8rem', fontSize: '0.8125rem' }}>
                        Stylist: {st.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Reviews listing */}
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: '700' }}>
                  Customer Reviews ({getSalonReviews(selectedSalon.id).length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {getSalonReviews(selectedSalon.id).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                      No styling reviews yet. Be the first to write one!
                    </div>
                  ) : (
                    getSalonReviews(selectedSalon.id).map(r => (
                      <div key={r.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{r.author}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              served by <strong>{r.stylistName}</strong>
                            </span>
                          </div>
                          <span style={{ color: '#fbbf24', fontSize: '0.8125rem' }}>{'★'.repeat(r.rating)}</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                          "{r.text}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Write review form */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: '700' }}>Submit a Styling Review</h3>

                {formSuccess && (
                  <div style={{ background: 'var(--success-soft)', color: 'var(--success-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }} className="animate-fade">
                    ✓ Thank you! Your review was successfully added to the directory list.
                  </div>
                )}

                <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>Your Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required
                        placeholder="e.g. Harry Potter"
                        value={reviewAuthor}
                        onChange={(e) => setReviewAuthor(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>Select Stylist</label>
                      <select 
                        className="form-select"
                        value={reviewStylist}
                        onChange={(e) => setReviewStylist(e.target.value)}
                      >
                        <option value="">Choose Stylist (Optional)</option>
                        {getSalonStaff(selectedSalon.id).map(st => (
                          <option key={st.id} value={st.name}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8125rem' }}>Rating</label>
                    <select 
                      className="form-select"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(e.target.value)}
                    >
                      <option value={5}>5 Stars - Elite Cut</option>
                      <option value={4}>4 Stars - Very Good</option>
                      <option value={3}>3 Stars - Average</option>
                      <option value={2}>2 Stars - Disappointed</option>
                      <option value={1}>1 Star - Bad Cut</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8125rem' }}>Your Comments</label>
                    <textarea 
                      className="form-control" 
                      rows={3} 
                      required
                      placeholder="Explain your styling feedback, guard length details, or service experience..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Publish Review
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
