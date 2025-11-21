'use client'

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, AlertCircle, X, RefreshCw, CreditCard, Wallet, ShieldCheck } from 'lucide-react';

// --- Mock Data & Configuration ---
const OPENING_HOUR = 10; // 10 AM
const CLOSING_HOUR = 22; // 10 PM
const TOTAL_SLOTS_PER_DAY = CLOSING_HOUR - OPENING_HOUR; 
const MAX_CAPACITY_PER_SLOT = 1; // Simulating strict 1-person/group booking per hour for demo
const TICKET_PRICE = 50000; // IDR 50k
const MAX_SEATS_PER_SESSION = 40;

// Helper to format dates
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', { 
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
  }).format(date);
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const generateTimeSlots = () => {
  const slots = [];
  for (let i = OPENING_HOUR; i < CLOSING_HOUR; i++) {
    slots.push(`${i}:00`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

type Booking = {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  status: string;
  price?: number;
  amount?: number;
};

type Notification = {
  type: 'success' | 'error' | 'info';
  message: string;
};

// Helper to get local date string (YYYY-MM-DD) in local time
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Demo Bookings ---
const demoBookings: Booking[] = [
  // Session FULL (40 seats)
  ...Array.from({ length: 40 }, (_, i) => ({
    id: `full-1-${i}`,
    date: getLocalDateString(new Date()),
    time: '10:00',
    createdAt: new Date().toISOString(),
    status: 'PAID',
    price: 50000,
    amount: 50000
  })),
  // Session NEARLY FULL (39 seats)
  ...Array.from({ length: 39 }, (_, i) => ({
    id: `almostfull-1-${i}`,
    date: getLocalDateString(new Date()),
    time: '12:00',
    createdAt: new Date().toISOString(),
    status: 'PAID',
    price: 50000,
    amount: 50000
  })),
  // Session with 10 seats booked
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `some-1-${i}`,
    date: getLocalDateString(new Date()),
    time: '14:00',
    createdAt: new Date().toISOString(),
    status: 'PAID',
    price: 50000,
    amount: 50000
  })),
];

export default function BookingApp() {
  // --- State ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'calendar' | 'slots' | 'payment' | 'dashboard'>('calendar');
  
  // New State for Payment Flow
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [showXenditModal, setShowXenditModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 'demo-1',
      date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
      time: '10:00',
      createdAt: new Date().toISOString(),
      status: 'PAID',
      price: 50000,
      amount: 50000
    },
    {
      id: 'demo-2',
      date: new Date().toISOString().split('T')[0],
      time: '12:00',
      createdAt: new Date().toISOString(),
      status: 'PAID',
      price: 50000,
      amount: 50000
    }
  ]);
  const [notification, setNotification] = useState<Notification | null>(null);

  // --- Helpers ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const isDateFull = (dateStr: string) => {
    const daysBookings = bookings.filter(b => b.date === dateStr);
    return daysBookings.length >= TIME_SLOTS.length * MAX_CAPACITY_PER_SLOT;
  };

  const getSessionBookings = (dateStr: string, time: string) => {
    return bookings.filter(b => b.date === dateStr && b.time === time);
  };

  const isSlotFull = (dateStr: string, time: string) => {
    return getSessionBookings(dateStr, time).length >= MAX_SEATS_PER_SESSION;
  };

  const hasUserBookedSession = (dateStr: string, time: string) => {
    // For demo, assume user can only book once per session (no user id, so just block multiple bookings in same session)
    // If you have userId, filter by userId as well
    return getSessionBookings(dateStr, time).length > 0;
  };

  const isSlotTaken = (dateStr: string, time: string) => {
    // Check if slot is full
    if (isSlotFull(dateStr, time)) return true;
    // Check if slot time is in the past
    const slotDateTime = new Date(`${dateStr}T${time}`);
    if (slotDateTime.getTime() < new Date().getTime()) return true;
    // Check if user already booked this session
    if (hasUserBookedSession(dateStr, time)) return true;
    return false;
  };

  const checkRescheduleValidity = (booking: Booking) => {
    const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
    const now = new Date();
    // Only allow reschedule if booking is in the future and more than 12 hours away
    if (bookingDateTime.getTime() < now.getTime()) return false; // can't reschedule if booking is in the past
    const diffInHours = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffInHours > 12;
  };

  // --- Actions ---
  const handleDayClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (date < today) return;
    setSelectedDate(date);
    setView('slots');
  };

  const handleSlotSelection = (time: string) => {
    if (!selectedDate) return;
    const dateStr = getLocalDateString(selectedDate);
    setPendingBooking({
      id: Math.random().toString(36).substr(2, 9),
      date: dateStr,
      time: time,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      price: TICKET_PRICE
    });
    setView('payment');
  };

  const handleInitiatePayment = () => {
    setShowXenditModal(true);
    setPaymentStatus('idle');
  };

  const handleConfirmPayment = () => {
    setPaymentStatus('processing');
    setTimeout(() => {
      setPaymentStatus('success');
      setTimeout(() => {
        finalizeBooking();
      }, 1500);
    }, 2000);
  };

  const finalizeBooking = () => {
    if (!pendingBooking || !selectedDate) return;
    const newBooking: Booking = {
      ...pendingBooking,
      status: 'PAID',
      amount: pendingBooking.price
    };
    setBookings([...bookings, newBooking]);
    setNotification({ type: 'success', message: `Payment successful! Booked for ${formatDate(selectedDate)} at ${pendingBooking.time}` });
    setShowXenditModal(false);
    setPendingBooking(null);
    setView('dashboard');
  };

  const handleCancelBooking = (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking || !checkRescheduleValidity(booking)) {
      setNotification({ type: 'error', message: 'Cannot cancel less than 12 hours before.' });
      return;
    }
    setBookings(bookings.filter(b => b.id !== id));
    setNotification({ type: 'success', message: 'Booking cancelled & refunded.' });
  };

  const handleRescheduleClick = (id: string) => {
    const booking = bookings.find(b => b.id === id);
    // Prevent reschedule if within 12 hours
    if (!booking || !checkRescheduleValidity(booking)) {
      setNotification({ type: 'error', message: 'Cannot reschedule less than 12 hours before.' });
      return;
    }
    setBookings(bookings.filter(b => b.id !== id));
    setNotification({ type: 'info', message: 'Credit retained. Select a new date.' });
    setView('calendar');
  };

  // --- Render Components ---

  const renderCalendar = () => {
    const { days, firstDay } = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    const blanks = Array(firstDay).fill(null);
    const dayArray = Array.from({ length: days }, (_, i) => i + 1);

    return (
      <div className="animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 hover:bg-slate-800 rounded-full">
            <ChevronLeft className="w-6 h-6 text-slate-400" />
          </button>
          <h2 className="text-xl font-bold text-slate-100">{monthName}</h2>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 hover:bg-slate-800 rounded-full">
            <ChevronRight className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-sm text-slate-500 font-medium">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {blanks.map((_, i) => <div key={`blank-${i}`} />)}
          {dayArray.map(day => {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dateStr = date.toISOString().split('T')[0];
            const isFull = isDateFull(dateStr);
            const isToday = new Date().toDateString() === date.toDateString();
            const isPast = date.getTime() < new Date().setHours(0,0,0,0);

            let btnClass = "h-14 rounded-xl flex flex-col items-center justify-center relative transition-all ";
            
            if (isPast) {
              btnClass += "bg-slate-900 text-slate-700 cursor-not-allowed";
            } else if (isFull) {
              btnClass += "bg-red-900/20 border border-red-900/50 text-red-500 cursor-not-allowed";
            } else {
              btnClass += "bg-slate-800 hover:bg-indigo-600 text-slate-200 cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/20";
            }

            if (isToday) btnClass += " border border-indigo-400";

            return (
              <button 
                key={day} 
                disabled={isPast || isFull}
                onClick={() => handleDayClick(day)}
                className={btnClass}
              >
                <span className={`text-lg font-bold ${isFull ? 'line-through opacity-50' : ''}`}>{day}</span>
                {isFull && <span className="text-[10px] absolute bottom-1 font-bold">FULL</span>}
                {isToday && !isFull && <span className="w-1 h-1 bg-indigo-400 rounded-full absolute bottom-2"></span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeSlots = () => {
    const dateStr = selectedDate ? getLocalDateString(selectedDate) : undefined;

    return (
      <div className="animate-fadeIn">
        <div className="flex items-center mb-6">
           <button onClick={() => setView('calendar')} className="mr-4 p-2 hover:bg-slate-800 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Select Time</h2>
            <p className="text-slate-400 text-sm">{formatDate(selectedDate!)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {TIME_SLOTS.map(time => {
            const taken = isSlotTaken(dateStr!, time);
            const full = isSlotFull(dateStr!, time);
            return (
              <button
                key={time}
                disabled={taken}
                onClick={() => handleSlotSelection(time)}
                className={`
                  py-4 rounded-2xl border-2 font-medium transition-all duration-200
                  flex flex-col items-center justify-center gap-1
                  ${taken 
                    ? 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed' 
                    : 'border-slate-700 bg-slate-800 text-indigo-300 hover:border-indigo-500 hover:bg-indigo-900/30 hover:text-white hover:scale-105'
                  }
                `}
              >
                <Clock className={`w-4 h-4 ${taken ? 'opacity-20' : 'mb-1'}`} />
                {time}
                {taken && <span className="text-[10px] uppercase">Booked</span>}
                {full && <span className="text-[10px] uppercase text-red-400">FULL</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOrderSummary = () => {
    if (!pendingBooking) return null;

    return (
      <div className="animate-fadeIn">
        <div className="flex items-center mb-6">
           <button onClick={() => setView('slots')} className="mr-4 p-2 hover:bg-slate-800 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-100">Order Summary</h2>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <span className="text-slate-400">Date</span>
            <span className="font-medium text-white">{formatDate(selectedDate!)}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <span className="text-slate-400">Time</span>
            <span className="font-medium text-white">{pendingBooking.time}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <span className="text-slate-400">Duration</span>
            <span className="font-medium text-white">1 Hour</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-lg font-bold text-slate-200">Total</span>
            <span className="text-2xl font-black text-indigo-400">{formatCurrency(pendingBooking.price!)}</span>
          </div>
        </div>

        <button 
          onClick={handleInitiatePayment}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] flex justify-center items-center gap-2"
        >
          Pay with Xendit
          <ShieldCheck className="w-5 h-5 opacity-70" />
        </button>
        <p className="text-center text-xs text-slate-500 mt-4 flex justify-center items-center gap-2">
          <span className="bg-slate-800 px-2 py-1 rounded">Secure Payment by Xendit</span>
        </p>
      </div>
    );
  };

  const renderXenditSimulation = () => {
    if (!showXenditModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-white text-slate-900 w-full max-w-sm rounded-xl overflow-hidden shadow-2xl animate-fadeIn">
          {/* Fake Xendit Header */}
          <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
            <div className="font-bold text-xl tracking-tight flex items-center gap-1">
               xendit <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">TEST</span>
            </div>
            <button onClick={() => setShowXenditModal(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Payment Body */}
          <div className="p-6">
            <div className="mb-6 text-center">
               <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Total Amount</p>
               <h3 className="text-3xl font-black text-slate-800">{formatCurrency(pendingBooking?.price || 0)}</h3>
            </div>

            {paymentStatus === 'idle' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Select Payment Method</p>
                
                <button 
                  onClick={handleConfirmPayment}
                  className="w-full border border-slate-200 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-50 hover:border-blue-500 transition-all group"
                >
                  <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center text-[10px] font-bold text-slate-500">BCA</div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">Virtual Account</span>
                </button>

                <button 
                  onClick={handleConfirmPayment}
                  className="w-full border border-slate-200 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-50 hover:border-blue-500 transition-all group"
                >
                  <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center text-[10px] font-bold text-white">VISA</div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">Credit Card</span>
                </button>

                <button 
                  onClick={handleConfirmPayment}
                  className="w-full border border-slate-200 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-50 hover:border-blue-500 transition-all group"
                >
                  <div className="w-10 h-6 bg-green-500 rounded flex items-center justify-center text-[10px] font-bold text-white">GOPAY</div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">GoPay / QRIS</span>
                </button>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div className="py-8 flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 font-medium animate-pulse">Processing Payment...</p>
                <p className="text-xs text-slate-400 mt-2">Please do not close this window</p>
              </div>
            )}

             {paymentStatus === 'success' && (
              <div className="py-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce-in">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-1">Payment Successful!</h4>
                <p className="text-sm text-slate-500">Redirecting back to merchant...</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
             <p className="text-[10px] text-slate-400">Powered by Xendit</p>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const sortedBookings = [...bookings].sort((a, b) => {
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    });

    return (
      <div className="animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-100">My Bookings</h2>
          <button 
            onClick={() => setView('calendar')} 
            className="text-sm bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors"
          >
            + New Booking
          </button>
        </div>

        {sortedBookings.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No active bookings found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedBookings.map(booking => {
              const isValid = checkRescheduleValidity(booking);
              const dateObj = new Date(`${booking.date}T${booking.time}`);
              const isPast = dateObj < new Date();

              return (
                <div key={booking.id} className="bg-slate-800 p-4 rounded-xl flex flex-col gap-4 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${isPast ? 'bg-slate-700 text-slate-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-200">{booking.time}</h3>
                        <p className="text-sm text-slate-400">{formatDate(new Date(booking.date))}</p>
                        
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                             PAID
                           </span>
                           {isPast && <span className="text-[10px] text-slate-500">Completed</span>}
                        </div>

                        {!isValid && !isPast && (
                          <div className="flex items-center gap-1 text-[10px] text-orange-400 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            &lt; 12h notice (Non-Refundable)
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                       <span className="text-sm font-bold text-slate-300 block">IDR 50,000</span>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-700/50 pt-3 mt-1">
                     {!isPast && (
                       <>
                        <button 
                          onClick={() => handleRescheduleClick(booking.id)}
                          disabled={!isValid}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${isValid ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                          <RefreshCw className="w-3 h-3" /> Reschedule
                        </button>
                        <button 
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={!isValid}
                          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${isValid ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                       </>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Toast Notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 pt-6 flex justify-between items-center">
        <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Example Booking
        </h1>
        <div className="flex gap-4 text-sm font-medium">
          <button 
            onClick={() => setView('calendar')}
            className={`${view !== 'dashboard' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Book
          </button>
          <button 
            onClick={() => setView('dashboard')}
            className={`${view === 'dashboard' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            My Bookings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto bg-slate-900/50 rounded-3xl p-6 border border-slate-800 shadow-2xl shadow-black/50 backdrop-blur-xl relative">
        {view === 'calendar' && renderCalendar()}
        {view === 'slots' && renderTimeSlots()}
        {view === 'payment' && renderOrderSummary()}
        {view === 'dashboard' && renderDashboard()}
      </main>

      {/* Modals */}
      {renderXenditSimulation()}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-bounce-in z-50 whitespace-nowrap ${
          notification.type === 'error' ? 'bg-red-500 text-white' : 
          notification.type === 'info' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes bounceIn {
           0% { transform: scale(0.8); opacity: 0; }
           60% { transform: scale(1.1); opacity: 1; }
           100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
}