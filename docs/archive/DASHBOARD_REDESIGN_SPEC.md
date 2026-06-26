# MADISON STUDIO - DASHBOARD REDESIGN SPECIFICATION

Version: 1.0 | Date: December 6, 2025 | For: Cursor Implementation

---

## 🎯 PROJECT OVERVIEW

**Objective**: Redesign the dashboard to reduce cognitive load by 40% while maintaining Madison's luxury aesthetic and guiding users through the Create → Multiply → Schedule workflow.

**Design Philosophy**: "Velvet Hammer" - sophisticated on surface, powerful underneath.

**Success Metrics**:

- Time to first action: < 30 seconds

- Onboarding completion: > 85%

- Daily engagement: +25%

---

## 📐 CURRENT STATE ANALYSIS

### Issues to Fix:

1. ❌ 7 competing sections create cognitive overload

2. ❌ Primary CTAs buried in checklist

3. ❌ "Living Brand Report" wastes prime real estate

4. ❌ Generic "Next Move" doesn't guide action

5. ❌ Calendar disconnected from workflow

6. ❌ "Your Progress" metrics don't drive action

### What's Working (Keep):

✅ Card-based layout with proper hierarchy

✅ Brand Health prominence

✅ Madison aesthetic (Black Books & Cream Paper)

✅ Clean typography system

---

## 🏗️ NEW LAYOUT ARCHITECTURE

### Layout Hierarchy (Top to Bottom):

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HERO SECTION                                                  │
│    Personalized greeting + 3 primary CTAs + AI suggestion       │
├─────────────────────────────────────────────────────────────────┤
│ 2. CONTENT PIPELINE                                              │
│    Visual flow: Draft → Scheduled → Published                   │
├─────────────────────────────────────────────────────────────────┤
│ 3. SMART MOMENTUM TRACKER                                        │
│    Weekly goal progress + encouragement                          │
├─────────────────────────────────────────────────────────────────┤
│ 4. THIS WEEK'S SCHEDULE                                          │
│    7-day calendar preview with scheduling CTA                   │
├─────────────────────────────────────────────────────────────────┤
│ 5. BRAND HEALTH SNAPSHOT (Collapsed by default)                 │
│    Score + expandable breakdown + report link                   │
├─────────────────────────────────────────────────────────────────┤
│ 6. GETTING STARTED (New users only - <5 tasks completed)        │
│    Onboarding checklist with hide option                        │
├─────────────────────────────────────────────────────────────────┤
│ 7. RECENT ACTIVITY (Collapsed by default)                       │
│    Editorial timeline for power users                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 DESIGN SYSTEM (MAINTAIN EXISTING)

### Typography:

- **Hero Greeting**: `font-cormorant text-3xl` (32px)

- **Section Headers**: `font-lato text-xl font-semibold` (20px)

- **Body Text**: `font-lato text-base` (16px)

- **Subtext**: `font-lato text-sm text-charcoal` (14px)

### Colors (Use existing Tailwind config):

- **Primary CTAs**: `bg-brass-gradient hover:shadow-brass-glow`

- **Cards**: `bg-parchment border border-stone`

- **Positive Progress**: `text-moss-green`

- **Neutral Text**: `text-ink-black`

### Spacing:

- **Card Padding**: `p-8` (32px)

- **Inter-Card Gap**: `space-y-6` (24px)

- **Max Width**: `max-w-7xl` (1400px)

### Animations:

- **Transitions**: `transition-all duration-300 ease-in-out`

- **Hover**: `hover:border-brass hover:shadow-brass-glow`

- **Collapse**: `transition-[max-height] duration-200`

---

## 📦 COMPONENT BREAKDOWN

### **1. DashboardHero.tsx** (NEW)

**Purpose**: Personalized greeting + primary action CTAs + AI suggestion

**Props**:

```typescript
interface DashboardHeroProps {
  userName: string;
  organization: string;
  recentContent?: MasterContent;
}
```

**Layout**:

```tsx
<div className="bg-parchment border border-stone p-8 rounded-lg">
  {/* Greeting */}
  <h1 className="font-cormorant text-3xl text-ink-black mb-2">
    Good {timeOfDay}, {firstName} ☀️
  </h1>
  <p className="font-lato text-base text-charcoal mb-6">
    Your brand is strong. Let's create something today.
  </p>
  
  {/* Primary CTAs */}
  <div className="flex gap-4 mb-6">
    <Button 
      variant="brass" 
      size="lg"
      onClick={() => navigate('/create')}
    >
      🔥 Create Content
    </Button>
    <Button 
      variant="outline" 
      size="lg"
      onClick={() => navigate('/multiply')}
    >
      ⚡ Multiply Last Piece
    </Button>
    <Button 
      variant="ghost" 
      size="lg"
      onClick={() => navigate('/schedule')}
    >
      📅 Schedule
    </Button>
  </div>
  
  {/* AI Suggestion */}
  {aiSuggestion && (
    <div className="flex items-start gap-3 bg-cream p-4 rounded-md">
      <div className="text-2xl">💡</div>
      <div>
        <p className="font-lato text-sm text-charcoal">
          Madison suggests:
        </p>
        <p className="font-lato text-base text-ink-black">
          {aiSuggestion.text}
        </p>
        <Button 
          variant="link" 
          className="mt-2"
          onClick={aiSuggestion.action}
        >
          {aiSuggestion.cta} →
        </Button>
      </div>
    </div>
  )}
</div>
```

**Logic**:

```typescript
// Time-based greeting
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
};

// AI Suggestion Logic
const generateAISuggestion = (stats: DashboardStats) => {
  // If last master piece has no derivatives
  if (stats.recentMaster && stats.recentMaster.derivatives === 0) {
    return {
      text: `Turn your "${stats.recentMaster.title}" into Instagram carousel`,
      cta: 'Multiply Now',
      action: () => navigate(`/multiply?master=${stats.recentMaster.id}`)
    };
  }
  
  // If no scheduled content this week
  if (stats.scheduledThisWeek === 0) {
    return {
      text: 'You have no content scheduled this week. Plan ahead?',
      cta: 'Schedule Content',
      action: () => navigate('/schedule')
    };
  }
  
  // If brand health has gaps
  if (stats.brandHealth.score < 85) {
    return {
      text: 'Improve your Brand Health to 85%+ for better content quality',
      cta: 'Review Gaps',
      action: () => setShowBrandHealth(true)
    };
  }
  
  // Default: encourage creation
  return {
    text: 'Ready to write your next masterpiece?',
    cta: 'Start Creating',
    action: () => navigate('/create')
  };
};
```

**Data Sources**:

- `useProfile()` - userName, firstName

- `useOrganization()` - organization name

- `useDashboardStats()` - recent content, scheduled count

- `useBrandHealth()` - brand health score

---

### **2. ContentPipelineFlow.tsx** (NEW)

**Purpose**: Visual workflow showing Draft → Scheduled → Published counts

**Props**:

```typescript
interface ContentPipelineFlowProps {
  draftCount: number;
  scheduledCount: number;
  publishedCount: number;
}
```

**Layout**:

```tsx
<div className="bg-parchment border border-stone p-8 rounded-lg">
  <h2 className="font-lato text-xl font-semibold mb-6">Content Pipeline</h2>
  
  <div className="flex items-center justify-between">
    {/* Draft */}
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-stone-light flex items-center justify-center mb-3">
        <FileText className="w-8 h-8 text-charcoal" />
      </div>
      <p className="font-lato text-2xl font-bold text-ink-black">{draftCount}</p>
      <p className="font-lato text-sm text-charcoal">Draft</p>
    </div>
    
    {/* Arrow */}
    <ArrowRight className="w-6 h-6 text-charcoal mx-4" />
    
    {/* Scheduled */}
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-brass-light flex items-center justify-center mb-3">
        <Calendar className="w-8 h-8 text-brass" />
      </div>
      <p className="font-lato text-2xl font-bold text-ink-black">{scheduledCount}</p>
      <p className="font-lato text-sm text-charcoal">Scheduled</p>
    </div>
    
    {/* Arrow */}
    <ArrowRight className="w-6 h-6 text-charcoal mx-4" />
    
    {/* Published */}
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-moss-light flex items-center justify-center mb-3">
        <CheckCircle className="w-8 h-8 text-moss-green" />
      </div>
      <p className="font-lato text-2xl font-bold text-ink-black">{publishedCount}</p>
      <p className="font-lato text-sm text-charcoal">Published</p>
    </div>
  </div>
  
  <div className="mt-6 text-center">
    <Button 
      variant="link" 
      onClick={() => navigate('/library')}
    >
      View Library →
    </Button>
  </div>
</div>
```

**Data Sources**:

- `useDashboardStats()` - counts from existing hook

---

### **3. SmartMomentumTracker.tsx** (NEW)

**Purpose**: Show weekly goal progress with actionable deficit

**Props**:

```typescript
interface SmartMomentumTrackerProps {
  weeklyGoal: number;
  createdThisWeek: number;
  weekEndsIn: number; // days
}
```

**Layout**:

```tsx
<div className="bg-parchment border border-stone p-8 rounded-lg">
  <div className="flex items-center gap-2 mb-4">
    <Flame className="w-5 h-5 text-brass" />
    <h2 className="font-lato text-xl font-semibold">Your Momentum</h2>
  </div>
  
  <div className="mb-4">
    <div className="flex justify-between items-center mb-2">
      <p className="font-lato text-base text-charcoal">
        Weekly Goal: {weeklyGoal} pieces
      </p>
      <p className="font-lato text-sm text-charcoal">
        {createdThisWeek} of {weeklyGoal}
      </p>
    </div>
    
    {/* Progress Bar */}
    <div className="w-full h-2 bg-stone-light rounded-full overflow-hidden">
      <div 
        className="h-full bg-brass transition-all duration-300"
        style={{ width: `${(createdThisWeek / weeklyGoal) * 100}%` }}
      />
    </div>
  </div>
  
  {/* Encouragement Text */}
  {deficit > 0 ? (
    <p className="font-lato text-sm text-charcoal mb-4">
      Create {deficit} more by {weekEndDay} to hit your goal
    </p>
  ) : (
    <p className="font-lato text-sm text-moss-green mb-4">
      ✨ Goal achieved! You're on a roll.
    </p>
  )}
  
  <Button 
    variant="brass" 
    onClick={() => navigate('/create')}
  >
    Create Now →
  </Button>
</div>
```

**Logic**:

```typescript
const deficit = Math.max(0, weeklyGoal - createdThisWeek);
const weekEndDay = getEndOfWeekDay(); // "Friday", "Sunday", etc.
```

**Data Sources**:

- `useOrganization()` - weeklyGoal from settings

- `useDashboardStats()` - createdThisWeek count

---

### **4. WeekSchedulePreview.tsx** (NEW)

**Purpose**: Show 7-day calendar with scheduling prompt

**Props**:

```typescript
interface WeekSchedulePreviewProps {
  scheduledDays: Record<string, number>; // date -> count
  currentWeek: Date[];
}
```

**Layout**:

```tsx
<div className="bg-parchment border border-stone p-8 rounded-lg">
  <h2 className="font-lato text-xl font-semibold mb-6">This Week</h2>
  
  <div className="grid grid-cols-7 gap-4 mb-6">
    {currentWeek.map((date, index) => (
      <div 
        key={date.toISOString()}
        className="flex flex-col items-center"
      >
        <p className="font-lato text-xs text-charcoal mb-1">
          {format(date, 'EEE')}
        </p>
        <p className="font-lato text-xl font-bold text-ink-black mb-2">
          {format(date, 'd')}
        </p>
        
        {/* Dots for scheduled content */}
        <div className="flex gap-1">
          {scheduledDays[format(date, 'yyyy-MM-dd')] > 0 && (
            <>
              <div className="w-2 h-2 rounded-full bg-brass" />
              {scheduledDays[format(date, 'yyyy-MM-dd')] > 1 && (
                <div className="w-2 h-2 rounded-full bg-brass" />
              )}
            </>
          )}
        </div>
      </div>
    ))}
  </div>
  
  {/* Empty State or CTA */}
  {totalScheduled === 0 ? (
    <div className="text-center">
      <p className="font-lato text-sm text-charcoal mb-4">
        Nothing scheduled today. Want to schedule something?
      </p>
      <Button 
        variant="outline" 
        onClick={() => navigate('/schedule')}
      >
        Schedule Content →
      </Button>
    </div>
  ) : (
    <div className="text-center">
      <Button 
        variant="link" 
        onClick={() => navigate('/schedule')}
      >
        View Full Calendar →
      </Button>
    </div>
  )}
</div>
```

**Data Sources**:

- `useScheduledContent()` - scheduled_content table query

- `date-fns` - date manipulation

---

### **5. BrandHealthCard.tsx** (UPDATED - Add Collapse)

**Purpose**: Brand health score with expandable breakdown

**Changes**:

```typescript
// Add state
const [isExpanded, setIsExpanded] = useState(() => {
  // Default collapsed for returning users
  const hasVisited = localStorage.getItem('dashboard-visited');
  return !hasVisited;
});

// Persist collapse state
useEffect(() => {
  localStorage.setItem('dashboard-visited', 'true');
}, []);
```

**Layout**:

```tsx
<div className="bg-parchment border border-stone p-8 rounded-lg">
  {/* Collapsed View (Always Visible) */}
  <button
    onClick={() => setIsExpanded(!isExpanded)}
    className="w-full flex items-center justify-between"
  >
    <div className="flex items-center gap-4">
      <div className="relative">
        <CircularProgress value={score} size={64} />
        <span className="absolute inset-0 flex items-center justify-center font-lato text-xl font-bold">
          {score}
        </span>
      </div>
      <div className="text-left">
        <h2 className="font-lato text-xl font-semibold">Brand Health</h2>
        <p className="font-lato text-sm text-charcoal">
          {rating} · Voice {voiceChange > 0 ? '+' : ''}{voiceChange}%
        </p>
      </div>
    </div>
    <ChevronDown 
      className={`w-5 h-5 text-charcoal transition-transform ${
        isExpanded ? 'rotate-180' : ''
      }`}
    />
  </button>
  
  {/* Expanded View (Collapsible) */}
  {isExpanded && (
    <div className="mt-6 space-y-4">
      {/* Category Breakdown */}
      {categories.map(category => (
        <div key={category.name}>
          <div className="flex justify-between items-center mb-2">
            <p className="font-lato text-sm text-ink-black">
              {category.name}
            </p>
            <p className="font-lato text-sm text-charcoal">
              {category.score}%
            </p>
          </div>
          <div className="w-full h-2 bg-stone-light rounded-full overflow-hidden">
            <div 
              className="h-full bg-brass transition-all duration-300"
              style={{ width: `${category.score}%` }}
            />
          </div>
          {category.score < 85 && (
            <Button 
              variant="link" 
              size="sm" 
              className="mt-1"
              onClick={() => handleFixGap(category)}
            >
              {category.action} →
            </Button>
          )}
        </div>
      ))}
      
      {/* Report Link */}
      <div className="pt-4 border-t border-stone">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/brand-report')}
        >
          📄 View Living Brand Report →
        </Button>
      </div>
    </div>
  )}
</div>
```

**Data Sources**:

- `useBrandHealth()` - existing hook (no changes needed)

---

### **6. OnboardingChecklist.tsx** (UPDATED - Add Hide Option)

**Purpose**: Guide new users through 5 key tasks

**Changes**:

```typescript
// Add visibility state
const [isVisible, setIsVisible] = useState(() => {
  const hidden = localStorage.getItem('onboarding-hidden');
  return !hidden && completedTasks < 5;
});

const handleHide = () => {
  localStorage.setItem('onboarding-hidden', 'true');
  setIsVisible(false);
};

// Auto-hide when all tasks complete
useEffect(() => {
  if (completedTasks === 5) {
    handleHide();
  }
}, [completedTasks]);
```

**Layout**:

```tsx
{isVisible && (
  <div className="bg-parchment border border-stone p-8 rounded-lg">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brass" />
        <h2 className="font-lato text-xl font-semibold">Getting Started</h2>
      </div>
      <p className="font-lato text-sm text-charcoal">
        {completedTasks} of 5 completed
      </p>
    </div>
    
    <div className="space-y-4">
      {tasks.map(task => (
        <div 
          key={task.id}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={task.completed}
              disabled
              className="w-5 h-5"
            />
            <div>
              <p className="font-lato text-base text-ink-black">
                {task.title}
              </p>
              <p className="font-lato text-xs text-charcoal">
                {task.description}
              </p>
            </div>
          </div>
          {!task.completed && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={task.action}
            >
              Start →
            </Button>
          )}
        </div>
      ))}
    </div>
    
    <div className="mt-6 pt-6 border-t border-stone">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleHide}
        className="text-charcoal"
      >
        Hide This - I Know What I'm Doing
      </Button>
    </div>
  </div>
)}
```

**Data Sources**:

- `useDashboardStats()` - task completion status

---

### **7. RecentActivityTimeline.tsx** (UPDATED - Add Collapse)

**Purpose**: Editorial activity log for power users

**Changes**:

```typescript
// Default collapsed
const [isExpanded, setIsExpanded] = useState(false);
```

**Layout**:

```tsx
<div className="bg-parchment border border-stone rounded-lg overflow-hidden">
  {/* Collapsed Header */}
  <button
    onClick={() => setIsExpanded(!isExpanded)}
    className="w-full flex items-center justify-between p-8"
  >
    <div>
      <h2 className="font-lato text-xl font-semibold text-left">
        Recent Activity
      </h2>
      <p className="font-lato text-sm text-charcoal text-left">
        View your editorial timeline
      </p>
    </div>
    <ChevronDown 
      className={`w-5 h-5 text-charcoal transition-transform ${
        isExpanded ? 'rotate-180' : ''
      }`}
    />
  </button>
  
  {/* Expanded Timeline */}
  {isExpanded && (
    <div className="px-8 pb-8">
      {/* Group by date */}
      {activityByDate.map(group => (
        <div key={group.date} className="mb-6">
          <p className="font-lato text-sm font-semibold text-charcoal mb-3">
            {group.label}
          </p>
          <div className="space-y-2">
            {group.activities.map(activity => (
              <div 
                key={activity.id}
                className="flex items-start gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-brass mt-2" />
                <div>
                  <p className="font-lato text-xs text-charcoal">
                    {format(activity.timestamp, 'h:mm a')}
                  </p>
                  <p className="font-lato text-sm text-ink-black">
                    {activity.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      <Button 
        variant="link" 
        className="mt-4"
        onClick={() => navigate('/activity')}
      >
        View Full Timeline →
      </Button>
    </div>
  )}
</div>
```

**Data Sources**:

- New `useRecentActivity()` hook (query recent actions across tables)

---

## 🔌 DATA HOOKS & QUERIES

### **useDashboardStats()** (EXISTING - Enhance)

Add these computed values:

```typescript
export const useDashboardStats = () => {
  // ... existing queries ...
  
  return {
    // Existing
    draftCount,
    scheduledCount,
    publishedCount,
    brandHealth,
    
    // NEW: Add these
    recentMaster: {
      id: string,
      title: string,
      derivatives: number,
      createdAt: Date
    },
    scheduledThisWeek: number,
    createdThisWeek: number,
    weeklyGoal: number,
    
    // NEW: AI Suggestion data
    aiSuggestion: {
      text: string,
      cta: string,
      action: () => void
    }
  };
};
```

### **useRecentActivity()** (NEW)

Query recent actions across all tables:

```typescript
export const useRecentActivity = (limit = 10) => {
  const { data: activities } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // Query master_content, derivative_assets, scheduled_content
      // with created_at timestamps
      // Return unified activity log
    }
  });
  
  // Group by date (Today, Yesterday, Earlier)
  const activityByDate = useMemo(() => 
    groupActivitiesByDate(activities),
    [activities]
  );
  
  return { activities, activityByDate };
};
```

---

## 📱 RESPONSIVE DESIGN

### **Mobile (< 768px)**:

```css
/* Stack all cards vertically */
.dashboard-container {
  @apply flex flex-col space-y-6 px-4;
}

/* Hero CTAs become vertical */
.hero-ctas {
  @apply flex flex-col gap-3;
}

/* Calendar shows 3 days only */
.week-preview {
  @apply grid grid-cols-3 gap-2;
}

/* Hide Recent Activity by default */
.recent-activity {
  @apply hidden md:block;
}
```

### **Tablet (768px - 1024px)**:

```css
/* 2-column grid for compatible cards */
.dashboard-grid {
  @apply grid grid-cols-2 gap-6;
}

/* Hero remains full-width */
.hero-section {
  @apply col-span-2;
}

/* Calendar shows 5 days */
.week-preview {
  @apply grid grid-cols-5 gap-3;
}
```

---

## 🎬 IMPLEMENTATION PHASES

### **Phase 1: Foundation** (Week 1)

- [ ] Create `DashboardHero.tsx`

- [ ] Create `ContentPipelineFlow.tsx`

- [ ] Update `DashboardNew.tsx` with new layout

- [ ] Test on desktop

### **Phase 2: Engagement** (Week 1)

- [ ] Create `SmartMomentumTracker.tsx`

- [ ] Create `WeekSchedulePreview.tsx`

- [ ] Add AI suggestion logic to `useDashboardStats()`

### **Phase 3: Polish** (Week 2)

- [ ] Update `BrandHealthCard.tsx` with collapse

- [ ] Update `OnboardingChecklist.tsx` with hide option

- [ ] Create `RecentActivityTimeline.tsx` with collapse

### **Phase 4: Responsive** (Week 2)

- [ ] Mobile optimization (< 768px)

- [ ] Tablet optimization (768px - 1024px)

- [ ] Test on real devices

### **Phase 5: QA & Launch** (Week 3)

- [ ] User testing with 5 people

- [ ] Fix bugs and polish animations

- [ ] Deploy to production

---

## 📊 SUCCESS METRICS

Track these post-launch:

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Time to First Action | Unknown | < 30s | Week 1 |
| Onboarding Completion | ~60% | > 85% | Week 2 |
| Daily Engagement | Unknown | +25% | Week 4 |
| "Getting Started" Hide Rate | N/A | < 15% | Week 2 |
| Mobile Bounce | Unknown | < 20% | Week 4 |

---

## 🚨 CRITICAL NOTES

1. **Do NOT remove existing functionality** - Only reorganize UI

2. **Maintain all existing hooks** - No breaking changes to data layer

3. **Test collapsed states persist** - Use localStorage properly

4. **Verify mobile works** - Test on actual devices, not just DevTools

5. **Keep Madison aesthetic** - Brass, parchment, serif typography

---

## 🎯 QUICK WINS (Ship Today)

1. **Add Hero Greeting**:

   ```typescript
   const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
   ```

2. **Collapse Brand Health**:

   ```typescript
   const [isExpanded, setIsExpanded] = useState(false);
   ```

3. **Replace "Your Next Move"**:

   - Change to specific AI suggestion

   - Example: "Turn your 'Winter Collection' post into Instagram"

4. **Hide Empty Calendar Dots**:

   ```typescript
   {scheduledCount > 0 && <div className="dot" />}
   ```

---

## 📝 NOTES FOR CURSOR

- Use existing component library (`@/components/ui`)

- Maintain TypeScript strict mode

- Follow existing naming conventions

- Use Tailwind utility classes (no inline styles)

- All new components in `@/components/dashboard`

- Keep accessibility (ARIA labels, keyboard nav)

---

**END OF SPECIFICATION**

Ready to implement? Start with Phase 1 components.

