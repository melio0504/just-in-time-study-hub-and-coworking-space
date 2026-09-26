"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Calendar, Award, Clock, LogOut, TrendingUp, BookOpen, Play, Pause, RotateCcw, Plus, X, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default function Account() {
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [recentBookings, setRecentBookings] = useState<
    Array<{
      id: string;
      date: string;
      seats: string[];
      duration: string;
      status: string;
    }>
  >([]);

  // Timer states
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [timerUnit, setTimerUnit] = useState<'minutes' | 'seconds'>('minutes');
  const [customTimerValue, setCustomTimerValue] = useState(25);

  // Flashcard states
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ question: '', answer: '' });
  const [flashcards, setFlashcards] = useState([
    { id: 1, question: 'What is React?', answer: 'A JavaScript library for building user interfaces' },
    { id: 2, question: 'What is a hook?', answer: 'Functions that let you use state and other React features' },
    { id: 3, question: 'What is JSX?', answer: 'A syntax extension for JavaScript that looks similar to HTML' },
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const loadAccount = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: bookings } = await supabase
        .from('bookings')
        .select('reservation_code, booking_date, seat_ids, duration_hours, status')
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(4);

      if (!cancelled) {
        setUserName(profile?.full_name || user.user_metadata.full_name || 'User');
        setUserEmail(user.email || '');
        setRecentBookings(
          (bookings ?? []).map((booking) => ({
            id: booking.reservation_code,
            date: booking.booking_date,
            seats: booking.seat_ids,
            duration: `${booking.duration_hours} hour${booking.duration_hours === 1 ? '' : 's'}`,
            status: booking.status.replace('_', ' ').replace(/^./, (letter) => letter.toUpperCase()),
          })),
        );
      }
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        if (timerSeconds === 0) {
          if (timerMinutes === 0) {
            setIsTimerRunning(false);
          } else {
            setTimerMinutes(timerMinutes - 1);
            setTimerSeconds(59);
          }
        } else {
          setTimerSeconds(timerSeconds - 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerMinutes, timerSeconds]);

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push('/');
    router.refresh();
  };

  const applyTimerSettings = (value = customTimerValue, unit = timerUnit) => {
    if (unit === 'minutes') {
      setTimerMinutes(value);
      setTimerSeconds(0);
    } else {
      setTimerMinutes(0);
      setTimerSeconds(value);
    }
    setIsTimerRunning(false);
    setShowTimerSettings(false);
  };

  const resetTimer = () => {
    applyTimerSettings();
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const timerPresets = timerUnit === 'seconds' ? [5, 10, 15, 30] : [5, 15, 25, 45];
  const timerUnitLabel = timerUnit === 'seconds' ? 'seconds' : 'minutes';
  const timerUnitShortLabel = timerUnit === 'seconds' ? 'sec' : 'min';

  const flipCard = () => {
    setIsCardFlipped(!isCardFlipped);
  };

  const nextCard = () => {
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
    setIsCardFlipped(false);
  };

  const previousCard = () => {
    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    setIsCardFlipped(false);
  };

  const addFlashcard = () => {
    if (newCard.question && newCard.answer) {
      setFlashcards([...flashcards, {
        id: Date.now(),
        question: newCard.question,
        answer: newCard.answer,
      }]);
      setNewCard({ question: '', answer: '' });
      setShowAddCard(false);
      setCurrentCardIndex(flashcards.length); // Go to the new card
      setIsCardFlipped(false);
    }
  };

  // Generate study activity data (GitHub-style contributions)
  const [studyData, setStudyData] = useState(() => [] as { date: string; hours: number; level: number }[]);

  useEffect(() => {
    const data: { date: string; hours: number; level: number }[] = [];
    const today = new Date();
    for (let i = 119; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const hours = Math.floor(Math.random() * 9);
      data.push({
        date: date.toISOString().split('T')[0],
        hours,
        level: hours === 0 ? 0 : hours < 2 ? 1 : hours < 4 ? 2 : hours < 6 ? 3 : 4,
      });
    }
    // Defer setState to avoid synchronous state update within effect
    setTimeout(() => setStudyData(data), 0);
  }, []);

  const getWeekData = (weekIndex: number) => {
    return studyData.slice(weekIndex * 7, (weekIndex + 1) * 7);
  };

  const getLevelColor = (level: number) => {
    const colors = ['#f3ede4', '#fef3dc', '#f4d98d', '#e5a930', '#d69520'];
    return colors[level];
  };

  const totalHours = studyData.reduce((sum, day) => sum + day.hours, 0);
  const averageHours = (totalHours / 120).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl mb-2 text-[#2d2520]">My Account</h1>
            <p className="text-lg text-[#6b5e52]">Welcome back, {userName}!</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white text-[#2d2520] px-6 py-3 rounded-full border border-[#f3ede4] hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Study History Dashboard */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4] mb-8">
          <div className="flex items-start justify-between mb-6 gap-8">
            <div className="flex-1">
              <h2 className="text-3xl text-[#2d2520] mb-6">Study History</h2>

              <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-[#6b5e52] w-8"></span>
              <div className="flex gap-4 text-xs text-[#6b5e52]">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                  <span key={month} className={idx % 3 === 0 ? '' : 'hidden md:inline'}>{month}</span>
                ))}
              </div>
            </div>

            <div className="inline-flex flex-col gap-1">
              {[null, 'Mon', null, 'Wed', null, 'Fri', null].map((day, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-1">
                  <span className="text-xs text-[#6b5e52] w-8">{day || ''}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 17 }).map((_, weekIndex) => {
                      const weekData = getWeekData(weekIndex);
                      const dayData = weekData[rowIndex];

                      return (
                        <div
                          key={weekIndex}
                          className="w-3 h-3 rounded-sm transition-all hover:scale-150 cursor-pointer"
                          style={{ backgroundColor: dayData ? getLevelColor(dayData.level) : '#f3ede4' }}
                          title={dayData ? `${dayData.date}: ${dayData.hours} hours` : ''}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

              <div className="flex items-center gap-2 mt-6 text-xs text-[#6b5e52]">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map(level => (
                  <div
                    key={level}
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: getLevelColor(level) }}
                  />
                ))}
                <span>More</span>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-[#f3ede4]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#fef3dc] rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#e5a930]" />
                  </div>
                  <p className="text-xs text-[#6b5e52] uppercase tracking-wider">Total Hours</p>
                </div>
                <p className="text-2xl text-[#2d2520]">{totalHours}h</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#f3ede4]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#fef3dc] rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[#e5a930]" />
                  </div>
                  <p className="text-xs text-[#6b5e52] uppercase tracking-wider">Avg/Day</p>
                </div>
                <p className="text-2xl text-[#2d2520]">{averageHours}h</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#f3ede4]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#fef3dc] rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-[#e5a930]" />
                  </div>
                  <p className="text-xs text-[#6b5e52] uppercase tracking-wider">Bookings</p>
                </div>
                <p className="text-2xl text-[#2d2520]">{recentBookings.length}</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#f3ede4]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#fef3dc] rounded-lg flex items-center justify-center">
                    <Award className="w-4 h-4 text-[#e5a930]" />
                  </div>
                  <p className="text-xs text-[#6b5e52] uppercase tracking-wider">Loyalty Points</p>
                </div>
                <p className="text-2xl text-[#2d2520]">1,250</p>
              </div>
            </div>
          </div>
        </div>

        {/* Study Helper Module */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4] mb-8">
          <h2 className="text-3xl mb-6 text-[#2d2520]">Study Helper</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Pomodoro Timer */}
            <div className="bg-[#fef3dc] rounded-2xl p-6 border border-[#e5a930]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-[#e5a930]" />
                  <h3 className="text-2xl text-[#2d2520]">Pomodoro Timer</h3>
                </div>
                <button
                  onClick={() => setShowTimerSettings(!showTimerSettings)}
                  className="w-8 h-8 bg-white text-[#2d2520] rounded-full flex items-center justify-center hover:bg-[#f3ede4] transition-colors border border-[#e5a930]"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {showTimerSettings && (
                <div className="mb-4 bg-white rounded-lg p-4 border border-[#e5a930]">
                  <label className="block text-sm text-[#6b5e52] mb-2">Focus Duration</label>
                  <select
                    value={timerUnit}
                    onChange={(e) => {
                      const nextUnit = e.target.value as 'minutes' | 'seconds';
                      setTimerUnit(nextUnit);
                      setCustomTimerValue(nextUnit === 'seconds' ? Math.max(customTimerValue, 5) : Math.max(customTimerValue, 1));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#f3ede4] focus:outline-none focus:ring-2 focus:ring-[#e5a930] mb-3 bg-white text-[#2d2520]"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="seconds">Seconds</option>
                  </select>
                  <input
                    type="number"
                    min={timerUnit === 'seconds' ? 5 : 1}
                    max="120"
                    value={customTimerValue}
                    onChange={(e) => {
                      const nextValue = parseInt(e.target.value) || (timerUnit === 'seconds' ? 5 : 1);
                      setCustomTimerValue(timerUnit === 'seconds' ? Math.max(nextValue, 5) : Math.max(nextValue, 1));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#f3ede4] focus:outline-none focus:ring-2 focus:ring-[#e5a930] mb-3 placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  />
                  <div className="flex flex-wrap gap-2 mb-3">
                    {timerPresets.map((preset) => (
                      <button
                        key={`${timerUnit}-${preset}`}
                        onClick={() => {
                          setCustomTimerValue(preset);
                          applyTimerSettings(preset, timerUnit);
                        }}
                        className="px-3 py-2 rounded-full border border-[#e5a930] bg-[#fef3dc] text-[#2d2520] text-sm hover:bg-[#f3ede4] transition-colors"
                      >
                        {preset} {timerUnitShortLabel}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => applyTimerSettings()}
                    className="w-full bg-[#e5a930] text-white px-4 py-2 rounded-lg hover:bg-[#d69520] transition-colors text-sm"
                  >
                    Apply {timerUnitLabel} setting
                  </button>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="text-6xl text-[#2d2520] mb-4 font-mono">
                  {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={toggleTimer}
                    className="w-12 h-12 bg-[#e5a930] text-white rounded-full flex items-center justify-center hover:bg-[#d69520] transition-colors"
                  >
                    {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="w-12 h-12 bg-white text-[#2d2520] rounded-full flex items-center justify-center hover:bg-[#f3ede4] transition-colors border border-[#e5a930]"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-[#6b5e52]">
                <p>• {customTimerValue} {timerUnitLabel} of focused work</p>
                <p>• 5 minutes break</p>
                <p>• Track your productivity sessions</p>
              </div>
            </div>

            {/* Flashcards */}
            <div className="bg-white rounded-2xl p-6 border border-[#f3ede4]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-[#e5a930]" />
                  <h3 className="text-2xl text-[#2d2520]">Flashcards</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#6b5e52]">
                    {currentCardIndex + 1} / {flashcards.length}
                  </span>
                  <button
                    onClick={() => setShowAddCard(!showAddCard)}
                    className="w-8 h-8 bg-[#e5a930] text-white rounded-full flex items-center justify-center hover:bg-[#d69520] transition-colors"
                  >
                    {showAddCard ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Add Card Form */}
              {showAddCard && (
                <div className="mb-4 space-y-3 bg-white rounded-xl p-4 border border-[#e5a930]">
                  <input
                    type="text"
                    placeholder="Question"
                    value={newCard.question}
                    onChange={(e) => setNewCard({ ...newCard, question: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] text-sm placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  />
                  <input
                    type="text"
                    placeholder="Answer"
                    value={newCard.answer}
                    onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] text-sm placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  />
                  <button
                    onClick={addFlashcard}
                    className="w-full bg-[#e5a930] text-white px-4 py-2 rounded-lg hover:bg-[#d69520] transition-colors text-sm"
                  >
                    Add Card
                  </button>
                </div>
              )}

              {/* Single Flashcard */}
              <div
                onClick={flipCard}
                className="bg-[#fef3dc] rounded-2xl p-8 cursor-pointer hover:bg-[#f4d98d] transition-all min-h-48 flex items-center justify-center text-center mb-6 border-2 border-[#e5a930]"
              >
                <p className="text-xl text-[#2d2520]">
                  {isCardFlipped
                    ? flashcards[currentCardIndex].answer
                    : flashcards[currentCardIndex].question}
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={previousCard}
                  className="bg-[#e5a930] text-white px-6 py-2 rounded-full hover:bg-[#d69520] transition-colors text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={flipCard}
                  className="bg-white text-[#2d2520] px-6 py-2 rounded-full border border-[#e5a930] hover:bg-[#f3ede4] transition-colors text-sm"
                >
                  Flip Card
                </button>
                <button
                  onClick={nextCard}
                  className="bg-[#e5a930] text-white px-6 py-2 rounded-full hover:bg-[#d69520] transition-colors text-sm"
                >
                  Next
                </button>
              </div>

              <p className="text-xs text-[#6b5e52] text-center mt-4">
                Click the card or tap Flip Card to reveal the answer
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Recent Bookings */}
          <div className="md:col-span-2 bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4]">
            <h2 className="text-3xl mb-6 text-[#2d2520]">Recent Bookings</h2>

            <div className="space-y-4">
              {recentBookings.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#f3ede4] p-6 text-center text-[#6b5e52]">
                  No bookings yet. Your reservations will appear here.
                </p>
              )}
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl p-6 border border-[#f3ede4] hover:border-[#e5a930] transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-1">
                        {booking.id}
                      </p>
                      <p className="text-lg text-[#2d2520]">
                        {new Date(booking.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                      {booking.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-[#6b5e52]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Seats: {booking.seats.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{booking.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loyalty & Profile */}
          <div className="space-y-8">
            {/* Profile */}
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4]">
              <h2 className="text-2xl mb-6 text-[#2d2520]">Profile</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[#6b5e52]" />
                  <div>
                    <p className="text-xs text-[#6b5e52] uppercase tracking-wider">Name</p>
                    <p className="text-[#2d2520]">{userName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[#6b5e52]" />
                  <div>
                    <p className="text-xs text-[#6b5e52] uppercase tracking-wider">Email</p>
                    <p className="text-[#2d2520]">{userEmail}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Loyalty Points */}
            <div className="bg-gradient-to-br from-[#e5a930] to-[#d69520] rounded-3xl p-8 shadow-lg text-white">
              <div className="flex items-center gap-3 mb-4">
                <Award className="w-8 h-8" />
                <h2 className="text-2xl">Loyalty Rewards</h2>
              </div>
              <p className="text-4xl mb-2">1,250 Points</p>
              <p className="text-white/90 text-sm mb-4">
                 You&apos;re 250 points away from your next reward!
              </p>
              <div className="bg-white/20 rounded-full h-2 mb-4">
                <div className="bg-white rounded-full h-2" style={{ width: '83%' }}></div>
              </div>
              <p className="text-xs text-white/80">
                Earn 10 points per hour of study time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
