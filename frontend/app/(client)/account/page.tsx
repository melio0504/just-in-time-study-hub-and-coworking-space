"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, LogOut, TrendingUp, BookOpen, Play, Pause, RotateCcw, Plus, X, Settings, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  buildStudyHistory,
  getStudyHistoryDateRange,
  STUDY_HISTORY_DAYS,
  type StudyDay,
} from '@/lib/study-history';
import { ReservationManager } from './_components/ReservationManager';
import { AccountSettings } from './_components/AccountSettings';

const STUDY_HISTORY_WEEKS = STUDY_HISTORY_DAYS / 7;

export default function Account() {
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [usernameChangedAt, setUsernameChangedAt] = useState<string | null>(null);
  const [accountClock, setAccountClock] = useState(() => Date.now());
  const [bookingCount, setBookingCount] = useState(0);
  const [studyData, setStudyData] = useState<StudyDay[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

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
  const [showDeleteCardModal, setShowDeleteCardModal] = useState(false);
  const [newCard, setNewCard] = useState({ question: '', answer: '' });
  const [flashcards, setFlashcards] = useState<
    Array<{ id: number; question: string; answer: string }>
  >([]);

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

      const { startDate, endDate } = getStudyHistoryDateRange();
      const [profileResult, bookingHistoryResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, username_changed_at')
          .eq('id', user.id)
          .single(),
        supabase
          .from('bookings')
          .select('booking_date, duration_hours')
          .eq('user_id', user.id)
          .gte('booking_date', startDate)
          .lte('booking_date', endDate),
      ]);

      const profile = profileResult.data;
      const bookingHistory = bookingHistoryResult.data ?? [];

      if (!cancelled) {
        setUserName(profile?.full_name || user.user_metadata.full_name || 'User');
        setUserEmail(user.email || '');
        setUsernameChangedAt(profile?.username_changed_at ?? null);
        setBookingCount(bookingHistory.length);
        setStudyData(buildStudyHistory(bookingHistory));
      }
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const clock = window.setInterval(() => setAccountClock(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

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

  useEffect(() => {
    if (!showDeleteCardModal) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDeleteCardModal(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showDeleteCardModal]);

  useEffect(() => {
    if (!showLogoutModal) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoggingOut) setShowLogoutModal(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isLoggingOut, showLogoutModal]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError('');

    if (isSupabaseConfigured) {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setLogoutError('We could not log you out. Please try again.');
        setIsLoggingOut(false);
        return;
      }
    }

    router.replace('/register');
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
    if (flashcards.length === 0) return;
    setIsCardFlipped(!isCardFlipped);
  };

  const nextCard = () => {
    if (flashcards.length === 0) return;
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
    setIsCardFlipped(false);
  };

  const previousCard = () => {
    if (flashcards.length === 0) return;
    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    setIsCardFlipped(false);
  };

  const addFlashcard = () => {
    const question = newCard.question.trim();
    const answer = newCard.answer.trim();

    if (question && answer) {
      setFlashcards([...flashcards, {
        id: Date.now(),
        question,
        answer,
      }]);
      setNewCard({ question: '', answer: '' });
      setShowAddCard(false);
      setCurrentCardIndex(flashcards.length); // Go to the new card
      setIsCardFlipped(false);
    }
  };

  const deleteCurrentFlashcard = () => {
    const cardToDelete = flashcards[currentCardIndex];
    if (!cardToDelete) return;

    const remainingCards = flashcards.filter((card) => card.id !== cardToDelete.id);
    setFlashcards(remainingCards);
    setCurrentCardIndex(Math.max(0, Math.min(currentCardIndex, remainingCards.length - 1)));
    setIsCardFlipped(false);
    setShowDeleteCardModal(false);
  };

  const getWeekData = (weekIndex: number) => {
    return studyData.slice(weekIndex * 7, (weekIndex + 1) * 7);
  };

  const getLevelColor = (level: number) => {
    return level > 0 ? '#d69520' : '#f3ede4';
  };

  const totalHours = studyData.reduce((sum, day) => sum + day.hours, 0);
  const averageHours = (totalHours / STUDY_HISTORY_DAYS).toFixed(1);
  const currentFlashcard = flashcards[currentCardIndex];

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
            type="button"
            onClick={() => {
              setLogoutError('');
              setShowLogoutModal(true);
            }}
            className="flex items-center gap-2 bg-white text-[#2d2520] px-6 py-3 rounded-full border border-[#f3ede4] hover:shadow-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Study History Dashboard */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4] mb-8">
          <div className="mb-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
              <div>
                <h2 className="text-3xl text-[#2d2520]">Study History</h2>
                <p className="mt-2 text-sm text-[#6b5e52]">Your booking activity over the last 52 weeks.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#f3ede4] bg-white p-5">
              <div className="min-w-[900px]">
                <div className="mb-3 grid grid-cols-12 pl-10 text-xs text-[#6b5e52]">
                  {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  {[null, 'Mon', null, 'Wed', null, 'Fri', null].map((day, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-2">
                      <span className="w-8 shrink-0 text-xs text-[#6b5e52]">{day || ''}</span>
                      <div
                        className="grid flex-1 gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${STUDY_HISTORY_WEEKS}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: STUDY_HISTORY_WEEKS }).map((_, weekIndex) => {
                          const weekData = getWeekData(weekIndex);
                          const dayData = weekData[rowIndex];

                          return (
                            <div
                              key={weekIndex}
                              className="aspect-square w-full rounded-[3px] transition-transform hover:scale-120 cursor-pointer"
                              style={{ backgroundColor: dayData ? getLevelColor(dayData.level) : '#f3ede4' }}
                              title={dayData
                                ? `${dayData.date}: ${dayData.hours} booked hour${dayData.hours === 1 ? '' : 's'}`
                                : 'No booking data'}
                              aria-label={dayData
                                ? `${dayData.date}: ${dayData.hours} booked hour${dayData.hours === 1 ? '' : 's'}`
                                : 'No booking data'}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-end gap-4 text-xs text-[#6b5e52]" aria-label="Study history color legend">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-[#f3ede4]" aria-hidden="true" />No booking</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-[#d69520]" aria-hidden="true" />Booked</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
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
              <p className="text-2xl text-[#2d2520]">{bookingCount}</p>
            </div>

          </div>
        </div>

        {/* Study Helper Module */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4] mb-8">
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-[#e5a930]">Focus toolkit</p>
            <h2 className="text-3xl text-[#2d2520]">Study Helper</h2>
            <p className="mt-2 max-w-2xl text-[#6b5e52]">
              Stay focused with a timed work session, then reinforce what you learned with your own flashcards.
            </p>
          </div>

          <div className="grid items-start gap-8 md:grid-cols-2">
            {/* Pomodoro Timer */}
            <div className="rounded-3xl border border-[#e5a930]/60 bg-gradient-to-br from-[#fff9ec] to-[#fef3dc] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5a930] text-white shadow-sm">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-2xl text-[#2d2520]">Pomodoro Timer</h3>
                    <p className="text-sm text-[#6b5e52]">One task. One focused session.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTimerSettings(!showTimerSettings)}
                  aria-label="Timer settings"
                  aria-expanded={showTimerSettings}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5a930] bg-white text-[#2d2520] transition-colors hover:bg-[#f3ede4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a930] cursor-pointer"
                >
                  <Settings className="w-5 h-5" />
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
                        className="px-3 py-2 rounded-full border border-[#e5a930] bg-[#fef3dc] text-[#2d2520] text-sm hover:bg-[#f3ede4] transition-colors cursor-pointer"
                      >
                        {preset} {timerUnitShortLabel}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => applyTimerSettings()}
                    className="w-full bg-[#e5a930] text-white px-4 py-2 rounded-lg hover:bg-[#d69520] transition-colors text-sm cursor-pointer"
                  >
                    Apply {timerUnitLabel} setting
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-white/80 bg-white/75 px-5 py-8 text-center shadow-inner">
                <span className="inline-flex rounded-full bg-[#fef3dc] px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#8b6518]">
                  {isTimerRunning ? 'Focus in progress' : 'Ready to focus'}
                </span>
                <div className="my-5 text-6xl font-mono tabular-nums text-[#2d2520] sm:text-7xl">
                  {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={toggleTimer}
                    className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-[#e5a930] px-6 py-3 text-white shadow-sm transition-all hover:bg-[#d69520] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d69520] focus-visible:ring-offset-2 cursor-pointer"
                  >
                    {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    {isTimerRunning ? 'Pause' : 'Start focus'}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e5a930] bg-white px-5 py-3 text-[#2d2520] transition-colors hover:bg-[#f3ede4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a930] cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-xs uppercase tracking-wider text-[#6b5e52]">Focus</p>
                  <p className="mt-1 font-medium text-[#2d2520]">{customTimerValue} {timerUnitShortLabel}</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-xs uppercase tracking-wider text-[#6b5e52]">Suggested break</p>
                  <p className="mt-1 font-medium text-[#2d2520]">5 min</p>
                </div>
              </div>
            </div>

            {/* Flashcards */}
            <div className="rounded-3xl border border-[#f3ede4] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fef3dc] text-[#e5a930]">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-2xl text-[#2d2520]">Flashcards</h3>
                    <p className="text-sm text-[#6b5e52]">Practice active recall at your pace.</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#f3ede4] px-3 py-1 text-sm text-[#6b5e52]">
                  {flashcards.length === 0 ? '0 cards' : `${currentCardIndex + 1} of ${flashcards.length}`}
                </span>
              </div>

              {/* Add Card Form */}
              {showAddCard && (
                <div className="mb-5 rounded-2xl border border-[#e5a930]/60 bg-[#fffaf0] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-[#2d2520]">Create a flashcard</h4>
                        <span className="rounded-full bg-[#e5a930] px-2.5 py-1 text-xs font-medium text-white">
                          Card #{flashcards.length + 1}
                        </span>
                      </div>
                      <p className="text-sm text-[#6b5e52]">Keep each prompt focused on one idea.</p>
                    </div>
                    <button
                      onClick={() => setShowAddCard(false)}
                      aria-label="Close flashcard form"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#6b5e52] hover:bg-white hover:text-[#2d2520] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <label htmlFor="flashcard-question" className="mb-1.5 block text-sm font-medium text-[#2d2520]">
                    Question or prompt
                  </label>
                  <textarea
                    id="flashcard-question"
                    rows={2}
                    placeholder="Example: What is active recall?"
                    value={newCard.question}
                    onChange={(e) => setNewCard({ ...newCard, question: e.target.value })}
                    className="mb-4 w-full resize-none rounded-xl border border-[#f3ede4] bg-white px-3 py-2.5 text-sm text-[#2d2520] placeholder:text-[#6b5e52]/70 focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                  />
                  <label htmlFor="flashcard-answer" className="mb-1.5 block text-sm font-medium text-[#2d2520]">
                    Answer
                  </label>
                  <textarea
                    id="flashcard-answer"
                    rows={3}
                    placeholder="Write the answer you want to remember."
                    value={newCard.answer}
                    onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })}
                    className="mb-4 w-full resize-none rounded-xl border border-[#f3ede4] bg-white px-3 py-2.5 text-sm text-[#2d2520] placeholder:text-[#6b5e52]/70 focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                  />
                  <button
                    onClick={addFlashcard}
                    disabled={!newCard.question.trim() || !newCard.answer.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e5a930] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#d69520] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Card
                  </button>
                </div>
              )}

              {currentFlashcard ? (
                <>
                  <button
                    onClick={flipCard}
                    className="mb-5 flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-[#e5a930] bg-[#fef3dc] p-8 text-center transition-all hover:-translate-y-0.5 hover:bg-[#f4d98d] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a930] focus-visible:ring-offset-2 cursor-pointer"
                  >
                    <span className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[#8b6518]">
                      {isCardFlipped ? 'Answer' : 'Question'}
                    </span>
                    <span className="text-xl text-[#2d2520]">
                      {isCardFlipped ? currentFlashcard.answer : currentFlashcard.question}
                    </span>
                    <span className="mt-5 text-xs text-[#6b5e52]">Tap to {isCardFlipped ? 'see the question' : 'reveal the answer'}</span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <button
                        onClick={previousCard}
                        disabled={flashcards.length <= 1}
                        className="rounded-full border border-[#f3ede4] bg-white px-4 py-2 text-sm text-[#2d2520] hover:border-[#e5a930] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        onClick={nextCard}
                        disabled={flashcards.length <= 1}
                        className="rounded-full border border-[#f3ede4] bg-white px-4 py-2 text-sm text-[#2d2520] hover:border-[#e5a930] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowDeleteCardModal(true)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete card
                      </button>
                      <button
                        onClick={() => setShowAddCard(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#e5a930] px-4 py-2 text-sm text-white hover:bg-[#d69520] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        New card
                      </button>
                    </div>
                  </div>
                </>
              ) : !showAddCard ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e5a930]/50 bg-[#fffaf0] px-6 py-10 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fef3dc] text-[#e5a930]">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h4 className="text-xl text-[#2d2520]">No flashcards yet</h4>
                  <p className="mt-2 max-w-sm text-sm text-[#6b5e52]">
                    Create your first question-and-answer card to begin a quick review session.
                  </p>
                  <button
                    onClick={() => setShowAddCard(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e5a930] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#d69520] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Create first card
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#f3ede4] bg-white/80 p-5">
              <h3 className="flex items-center gap-2 font-medium text-[#2d2520]">
                <Clock className="h-4 w-4 text-[#e5a930]" />
                How the Pomodoro Timer works
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#6b5e52]">
                Choose a focus length, start the timer, and work on one task until time is up. Take a short five-minute break, then begin another focused session when you are ready.
              </p>
            </div>
            <div className="rounded-2xl border border-[#f3ede4] bg-white/80 p-5">
              <h3 className="flex items-center gap-2 font-medium text-[#2d2520]">
                <BookOpen className="h-4 w-4 text-[#e5a930]" />
                How Flashcards work
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#6b5e52]">
                Add a question on the front and its answer on the back. Try to recall the answer before revealing it, then move through your cards and repeat the ones that need more practice.
              </p>
            </div>
          </div>
        </div>

        {showLogoutModal && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-[#2d2520]/60 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget && !isLoggingOut) {
                setShowLogoutModal(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-title"
              aria-describedby="logout-description"
              className="w-full max-w-md rounded-3xl border border-[#f3ede4] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3dc] text-[#b47b0d]">
                <LogOut className="h-5 w-5" />
              </div>
              <h2 id="logout-title" className="mt-5 text-2xl text-[#2d2520]">
                Log out of your account?
              </h2>
              <p id="logout-description" className="mt-2 text-sm leading-6 text-[#6b5e52]">
                You will be returned to the registration page and will need to sign in again to access your account.
              </p>

              {logoutError && (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {logoutError}
                </p>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  autoFocus
                  className="cursor-pointer rounded-full border border-[#f3ede4] bg-white px-5 py-2.5 text-sm text-[#2d2520] transition-colors hover:border-[#e5a930] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stay signed in
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2d2520] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#44382f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Logging out…' : 'Log out'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteCardModal && currentFlashcard && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2520]/55 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) setShowDeleteCardModal(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-flashcard-title"
              aria-describedby="delete-flashcard-description"
              className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h2 id="delete-flashcard-title" className="text-2xl text-[#2d2520]">
                Delete flashcard #{currentCardIndex + 1}?
              </h2>
              <p id="delete-flashcard-description" className="mt-2 text-sm leading-6 text-[#6b5e52]">
                This will permanently remove “{currentFlashcard.question}” from your flashcards. This action cannot be undone.
              </p>
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteCardModal(false)}
                  autoFocus
                  className="rounded-full border border-[#f3ede4] bg-white px-5 py-2.5 text-sm text-[#2d2520] transition-colors hover:border-[#e5a930] hover:bg-[#fffaf0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteCurrentFlashcard}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete card
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid items-start gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <ReservationManager />
          </div>

          <AccountSettings
            key={userEmail}
            username={userName}
            email={userEmail}
            usernameChangedAt={usernameChangedAt}
            currentTimestamp={accountClock}
            onUsernameChanged={(nextUsername, changedAt) => {
              setUserName(nextUsername);
              setUsernameChangedAt(changedAt);
            }}
          />
        </div>
      </div>
    </div>
  );
}
