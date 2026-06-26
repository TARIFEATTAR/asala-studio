# 🧪 Tooltip Testing Guide

## Quick Start Testing

### 1. Reset Your Onboarding State

Open browser console and run:

```javascript
// Clear all tooltip and checklist data
localStorage.clear();

// Or selectively clear just tooltip data:
Object.keys(localStorage).forEach(key => {
  if (key.includes('tooltip') || key.includes('checklist')) {
    localStorage.removeItem(key);
  }
});

// Reload the page
location.reload();
```

---

## 2. Test Each Tooltip

### Test 1: Editor Tooltip (First Content)
**Trigger:** Create your first piece of content

1. Navigate to `/create` (Forge page)
2. Generate any content
3. Content is saved automatically
4. Navigate to `/editor` with the content
5. **Expected:** Tooltip appears on the editor area after 800ms
   - Title: "Refine Your Content"
   - Description: "You can edit and refine your generated content here..."
   - Position: Top

**Analytics to check:**
```javascript
JSON.parse(localStorage.getItem('tooltip_stats_editor_refine_content'))
// Should show: { viewed: 1, ... }
```

---

### Test 2: Library Tooltips
**Trigger:** Click "Explore Library" in checklist

1. Go to `/dashboard`
2. Click "Explore Your Library" in the Getting Started checklist
3. Navigate to `/library`
4. **Expected:** Two tooltips may appear (one at a time)

**Tooltip A: Search Bar**
- Target: Library search input
- Title: "Search Your Archive"
- Position: Bottom

**Tooltip B: Content Type Filter**
- Target: Content type dropdown
- Title: "Explore Content Types"
- Position: Bottom

---

### Test 3: Calendar Tooltip
**Trigger:** Click "Schedule a Post" in checklist

1. Go to `/dashboard`
2. Click "Schedule a Post" in checklist
3. Navigate to `/calendar`
4. **Expected:** Tooltip on "Schedule Content" button
   - Title: "Schedule Your Content"
   - Description: "Click here to schedule a post..."
   - Position: Left

---

### Test 4: Brand Builder Tooltip
**Trigger:** Click "Customize Your Brand" in checklist

1. Go to `/dashboard`
2. Click "Customize Your Brand" in checklist
3. Navigate to `/brand-builder`
4. **Expected:** Tooltip on Brand Voice card
   - Title: "Define Your Brand Voice"
   - Description: "Customize your brand's tone, style, and personality..."
   - Position: Right

---

### Test 5: Multiply Tooltip
**Trigger:** Click "Try Content Multiplication" in checklist

1. Go to `/dashboard`
2. Click "Try Content Multiplication" in checklist
3. Navigate to `/multiply`
4. **Expected:** Tooltip on master content selector
   - Title: "Select Master Content"
   - Description: "Choose a piece of content to multiply..."
   - Position: Bottom

---

## 3. Test Analytics Tracking

### View All Analytics in Console

```javascript
// Get all tooltip stats
const getAllStats = () => {
  const stats = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('tooltip_stats_')) {
      const tooltipId = key.replace('tooltip_stats_', '');
      stats[tooltipId] = JSON.parse(localStorage.getItem(key));
    }
  }
  return stats;
};

console.table(getAllStats());
```

### Check Pending Events

```javascript
// View events waiting to sync
const pending = localStorage.getItem('tooltip_analytics_pending');
console.log(JSON.parse(pending || '[]'));
```

### Test Each Event Type

1. **View Event:**
   - Tooltip appears
   - Check: `tooltip_stats_${id}` has `viewed: 1`

2. **Dismiss Event:**
   - Click X button
   - Check: `tooltip_stats_${id}` has `dismissed: 1`

3. **Complete Event:**
   - Click "Got it" button
   - Check: `tooltip_stats_${id}` has `completed: 1`

4. **Action Event:**
   - Click action button (if tooltip has one)
   - Check: `tooltip_stats_${id}` has `action_clicked: 1`

---

## 4. Test A/B Testing

### Enable A/B Testing

1. Edit `/src/config/tooltipConfig.ts`:
   ```typescript
   AB_TEST: {
     ENABLED: true, // Change to true
     // ...
   }
   ```

2. Clear localStorage and reload

3. Check assigned variant:
   ```javascript
   console.log('Variant:', localStorage.getItem('tooltip_ab_variant'));
   console.log('Name:', localStorage.getItem('tooltip_ab_variant_name'));
   ```

4. Test different delays:
   - Variant A (Fast): 500ms delay
   - Variant B (Default): 800ms delay
   - Variant C (Patient): 1200ms delay

### Force Specific Variant

```javascript
// Force variant A
localStorage.setItem('tooltip_ab_variant', 'A');
localStorage.setItem('tooltip_ab_variant_name', 'Fast');
location.reload();
```

---

## 5. View Analytics Dashboard

### Option 1: Add to Settings Page

```tsx
// In your settings/admin page
import { TooltipAnalyticsDashboard } from "@/components/onboarding/TooltipAnalyticsDashboard";

function SettingsPage() {
  return (
    <div className="p-8">
      <h1>Settings</h1>
      
      {/* Add dashboard */}
      <div className="mt-8">
        <TooltipAnalyticsDashboard />
      </div>
    </div>
  );
}
```

### Option 2: Temporary Test Route

Add to your router:
```tsx
{
  path: "/tooltip-analytics",
  element: <TooltipAnalyticsDashboard />,
}
```

Then visit: `http://localhost:5173/tooltip-analytics`

---

## 6. Common Issues & Solutions

### Tooltip Not Appearing?

**Check 1: Target element exists**
```javascript
document.querySelector('[data-tooltip-target="schedule-button"]')
// Should return the element, not null
```

**Check 2: Checklist task completed**
```javascript
const userId = 'your-user-id'; // Get from auth
const progress = localStorage.getItem(`checklist_progress_${userId}`);
console.log(JSON.parse(progress));
// Should show task as true
```

**Check 3: Tooltip not already shown**
```javascript
localStorage.getItem('tooltip_shown_editor_refine_content')
// Should be null if not shown yet
```

**Check 4: Correct route**
- Editor tooltip only shows on `/editor` route
- Calendar tooltip only shows on `/calendar` route
- etc.

---

### Analytics Not Tracking?

**Check 1: User authenticated**
```javascript
// Should have user object
const { user } = useAuth();
console.log(user);
```

**Check 2: Analytics enabled**
```javascript
import { TOOLTIP_CONFIG } from '@/config/tooltipConfig';
console.log(TOOLTIP_CONFIG.ENABLE_ANALYTICS); // Should be true
```

**Check 3: Events in localStorage**
```javascript
localStorage.getItem('tooltip_analytics_pending')
// Should have events array
```

---

### Tooltip Positioning Wrong?

The tooltip calculates position based on target element.

**Debug positioning:**
```javascript
// In browser console while tooltip is visible
const target = document.querySelector('[data-tooltip-target="..."]');
const rect = target.getBoundingClientRect();
console.log('Target position:', rect);
```

**Adjust position prop:**
```typescript
// In useOnboardingTooltips.tsx
{
  position: "top", // Try: "bottom", "left", "right"
}
```

---

## 7. Performance Testing

### Measure Tooltip Load Time

```javascript
// Add to ContextualTooltip.tsx for testing
const startTime = performance.now();

// After tooltip appears:
const loadTime = performance.now() - startTime;
console.log(`Tooltip loaded in ${loadTime}ms`);
```

### Expected Timings
- Initial delay: 800ms (configurable)
- Element search: <100ms (if element exists)
- Render time: <50ms
- **Total:** ~850-950ms

---

## 8. User Flow Testing

### Complete New User Journey

1. **Sign up** as new user
2. **Complete onboarding** (upload brand assets)
3. **Dashboard:** See Getting Started checklist
4. **Create first content:**
   - Click "Create Your First Content"
   - Generate content in Forge
   - Navigate to editor
   - ✅ See editor tooltip
5. **Explore library:**
   - Click "Explore Your Library"
   - Navigate to library
   - ✅ See library tooltips
6. **Schedule content:**
   - Click "Schedule a Post"
   - Navigate to calendar
   - ✅ See calendar tooltip
7. **Customize brand:**
   - Click "Customize Your Brand"
   - Navigate to brand builder
   - ✅ See brand voice tooltip
8. **Try multiply:**
   - Click "Try Content Multiplication"
   - Navigate to multiply
   - ✅ See multiply tooltip

### Check Analytics After Journey

```javascript
// Should have data for all tooltips
console.table(getAllStats());

// Should have multiple events
const pending = JSON.parse(localStorage.getItem('tooltip_analytics_pending') || '[]');
console.log(`${pending.length} events tracked`);
```

---

## 9. Reset Commands

### Reset Everything
```javascript
localStorage.clear();
location.reload();
```

### Reset Just Tooltips
```javascript
Object.keys(localStorage).forEach(key => {
  if (key.includes('tooltip')) {
    localStorage.removeItem(key);
  }
});
location.reload();
```

### Reset Just Checklist
```javascript
Object.keys(localStorage).forEach(key => {
  if (key.includes('checklist')) {
    localStorage.removeItem(key);
  }
});
location.reload();
```

### Reset Specific Tooltip
```javascript
localStorage.removeItem('tooltip_shown_editor_refine_content');
localStorage.removeItem('tooltip_stats_editor_refine_content');
location.reload();
```

---

## 10. Production Checklist

Before deploying to production:

- [ ] Test all 6 tooltips appear correctly
- [ ] Test all analytics events track properly
- [ ] Test on mobile devices (responsive positioning)
- [ ] Test with slow network (tooltip still appears)
- [ ] Verify A/B test assignment works
- [ ] Check analytics dashboard displays correctly
- [ ] Test tooltip dismissal persists across sessions
- [ ] Verify no console errors
- [ ] Test with ad blockers enabled
- [ ] Test accessibility (keyboard navigation, screen readers)

---

## 11. Monitoring in Production

### Key Metrics to Watch

1. **Completion Rate by Tooltip:**
   ```
   Target: >70% completion rate
   Alert if: <50% completion rate
   ```

2. **Dismissal Rate:**
   ```
   Target: <30% dismissal rate
   Alert if: >50% dismissal rate
   ```

3. **Action Click Rate:**
   ```
   Target: >50% action rate
   Alert if: <30% action rate
   ```

4. **Time to First Tooltip:**
   ```
   Target: <2 seconds after page load
   Alert if: >5 seconds
   ```

### Analytics Queries (Once DB is set up)

```sql
-- Completion rate by tooltip
SELECT 
  tooltip_id,
  COUNT(*) FILTER (WHERE event_type = 'viewed') as views,
  COUNT(*) FILTER (WHERE event_type = 'completed') as completions,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'completed')::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'viewed'), 0) * 100, 
    2
  ) as completion_rate
FROM tooltip_analytics
GROUP BY tooltip_id
ORDER BY completion_rate DESC;

-- A/B test results
SELECT 
  ab_variant,
  COUNT(DISTINCT user_id) as users,
  AVG(
    CASE WHEN event_type = 'completed' THEN 1 ELSE 0 END
  ) as avg_completion_rate
FROM tooltip_analytics
WHERE ab_variant IS NOT NULL
GROUP BY ab_variant;
```

---

## 🎉 Happy Testing!

If you encounter any issues, check:
1. Browser console for errors
2. Network tab for failed requests
3. localStorage for data
4. Element inspector for data attributes

**Need help?** Check the main implementation doc:
`TOOLTIP_IMPLEMENTATION_COMPLETE.md`
