# Onboarding System - Quick Reference

## ✅ Implementation Complete

All requirements have been implemented. Here's your quick reference guide.

---

## 1. ✅ Supabase Profiles Table Updated

**Migration File:** `supabase/migrations/add_onboarding_fields_to_profiles.sql`

**Fields Added:**
```sql
current_onboarding_step integer DEFAULT 1
onboarding_status text DEFAULT 'not_started'
has_scanned_website boolean DEFAULT false
has_uploaded_docs boolean DEFAULT false
has_scheduled_call boolean DEFAULT false
```

**To Apply:**
```bash
# Run in your Supabase SQL editor or via CLI
supabase db push
```

---

## 2. ✅ Helper Function: `updateOnboardingStep`

**Location:** `src/lib/onboarding.ts`

**Usage:**
```typescript
import { updateOnboardingStep } from '@/lib/onboarding';

// Example: After scanning website
await updateOnboardingStep(3, { has_scanned_website: true });

// Example: After uploading docs
await updateOnboardingStep(4, { has_uploaded_docs: true });

// Example: After scheduling call
await updateOnboardingStep(5, {
  has_scheduled_call: true,
  onboarding_status: 'complete'
});
```

**Function Signature:**
```typescript
async function updateOnboardingStep(
  stepNumber: number,
  updates?: {
    has_scanned_website?: boolean;
    has_uploaded_docs?: boolean;
    has_scheduled_call?: boolean;
    onboarding_status?: 'not_started' | 'in_progress' | 'complete';
  }
): Promise<Profile | null>
```

---

## 3. ✅ Onboarding Guard Function

**Location:** `src/lib/onboarding.ts`

### Function: `getOnboardingRedirectPath()`

**Logic:**
```typescript
export async function getOnboardingRedirectPath(): Promise<string | null> {
  const profile = await getUserProfile();
  
  if (!profile) return '/auth';
  
  // If onboarding is complete, allow access to dashboard
  if (profile.onboarding_status === 'complete') {
    return null; // No redirect needed
  }

  // Route based on current step
  const step = profile.current_onboarding_step || 1;
  
  switch (step) {
    case 1:
      return '/onboarding/step1';
    case 2:
      return '/onboarding/step2';
    case 3:
      return '/onboarding/step3';
    case 4:
      return '/onboarding/schedule';
    case 5:
      return '/onboarding/finish';
    default:
      return '/dashboard';
  }
}
```

### Component: `OnboardingGuard`

**Location:** `src/components/onboarding/OnboardingGuard.tsx`

**Usage:**
```tsx
import { OnboardingGuard } from '@/components/onboarding/OnboardingGuard';

// Wrap any protected route
<OnboardingGuard>
  <YourProtectedContent />
</OnboardingGuard>
```

### Hook: `useOnboardingGuard`

**Usage:**
```tsx
import { useOnboardingGuard } from '@/components/onboarding/OnboardingGuard';

function MyComponent() {
  const { redirectBasedOnOnboarding } = useOnboardingGuard();
  
  useEffect(() => {
    redirectBasedOnOnboarding();
  }, []);
}
```

---

## 4. ✅ Applied to `/onboarding` Route

**Location:** `src/pages/Onboarding.tsx`

The main onboarding page now:
- ✅ Loads state from Supabase profiles table
- ✅ Updates database after each step
- ✅ Maintains localStorage for backward compatibility
- ✅ Redirects based on `current_onboarding_step`

**Key Implementation:**
```tsx
// Loads from database on mount
useEffect(() => {
  const loadOnboardingProgress = async () => {
    const profile = await getUserProfile();
    if (profile) {
      setCurrentStep(profile.current_onboarding_step || 1);
    }
  };
  loadOnboardingProgress();
}, [user]);
```

---

## 5. ✅ Onboarding Step Handlers Updated

### After Scanning Website (Step 1 → Step 3)

```typescript
const handleStepComplete = async (stepData: any) => {
  if (currentStep === 1) {
    await updateOnboardingStep(3, {
      has_scanned_website: !!stepData.hasWebsiteScan,
      onboarding_status: 'in_progress',
    });
    setCurrentStep(3);
  }
};
```

### After Uploading Docs (Step 3 → Step 4)

```typescript
const handleStepComplete = async (stepData: any) => {
  if (currentStep === 3) {
    await updateOnboardingStep(4, {
      has_uploaded_docs: true,
      onboarding_status: 'in_progress',
    });
    setCurrentStep(4);
  }
};
```

### After Scheduling Call (Step 4 → Complete)

```typescript
const handleComplete = async (destination: string) => {
  await updateOnboardingStep(5, {
    has_scheduled_call: true,
    onboarding_status: 'complete'
  });
  navigate('/dashboard');
};
```

---

## 🎯 Complete Example: Onboarding Component

Here's how to use the system in a custom onboarding step:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateOnboardingStep } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';

export function OnboardingStep3() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    setUploading(true);
    
    try {
      // Your upload logic here
      await uploadDocuments();
      
      // Update onboarding progress
      await updateOnboardingStep(4, {
        has_uploaded_docs: true,
        onboarding_status: 'in_progress'
      });
      
      // Navigate to next step
      navigate('/onboarding/schedule');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = async () => {
    // Still update step, but don't mark docs as uploaded
    await updateOnboardingStep(4, {
      has_uploaded_docs: false,
      onboarding_status: 'in_progress'
    });
    navigate('/onboarding/schedule');
  };

  return (
    <div>
      <h1>Upload Your Brand Documents</h1>
      <Button onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Documents'}
      </Button>
      <Button onClick={handleSkip} variant="ghost">
        Skip for now
      </Button>
    </div>
  );
}
```

---

## 🔧 Testing & Debugging

### Check Current Onboarding State

```typescript
import { getUserProfile } from '@/lib/onboarding';

const profile = await getUserProfile();
console.log({
  step: profile?.current_onboarding_step,
  status: profile?.onboarding_status,
  scannedWebsite: profile?.has_scanned_website,
  uploadedDocs: profile?.has_uploaded_docs,
  scheduledCall: profile?.has_scheduled_call,
});
```

### Reset Onboarding

```typescript
// Via URL
// Navigate to: /onboarding?reset=true

// Or programmatically
await updateOnboardingStep(1, {
  onboarding_status: 'not_started',
  has_scanned_website: false,
  has_uploaded_docs: false,
  has_scheduled_call: false,
});
```

### Force Complete Onboarding

```typescript
await updateOnboardingStep(5, {
  onboarding_status: 'complete'
});
```

---

## 📋 Checklist

- [x] SQL migration created
- [x] TypeScript types updated
- [x] Helper functions created
- [x] Onboarding guard implemented
- [x] Main onboarding page updated
- [x] Step handlers integrated
- [x] Documentation written

## 🚀 Next Steps

1. **Apply the migration:**
   ```bash
   # In Supabase SQL editor, run:
   # supabase/migrations/add_onboarding_fields_to_profiles.sql
   ```

2. **Test the flow:**
   - Create a new test user
   - Go through onboarding
   - Verify database updates
   - Check redirects work correctly

3. **Update your custom components:**
   - Replace any manual step tracking with `updateOnboardingStep`
   - Add `OnboardingGuard` to protected routes
   - Use `getUserProfile` to check onboarding state

---

## 📚 Full Documentation

See `docs/ONBOARDING_SYSTEM_GUIDE.md` for complete documentation.
