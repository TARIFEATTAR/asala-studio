import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { getIndustryTemplate } from "@/config/industryTemplates";
import { logger } from "@/lib/logger";

type OnboardingStep = "welcome_pending" | "document_pending" | "first_generation_pending" | "completed";

export function useOnboarding() {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showForgeGuide, setShowForgeGuide] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("completed");
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!user || hasCheckedRef.current) {
      logger.debug("[useOnboarding] Skipping check:", { hasUser: !!user, hasChecked: hasCheckedRef.current });
      if (!user) setIsLoading(false);
      return;
    }

    hasCheckedRef.current = true;

    logger.debug("[useOnboarding] Starting onboarding check for user:", user.id);
    const checkOnboardingStatus = async () => {
      try {
        // Get onboarding step from localStorage first (fast, no network call)
        const stepKey = `onboarding_step_${user.id}`;
        const savedStep = localStorage.getItem(stepKey) as OnboardingStep | null;
        const currentStep = savedStep || "completed";
        setOnboardingStep(currentStep);

        // Run organization queries in parallel for faster loading
        // Use .order().limit(1) to get the FIRST organization (oldest) to enforce one-per-user
        const [existingMemberResult, existingOrgResult] = await Promise.all([
          supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1),
          supabase
            .from("organizations")
            .select("id")
            .eq("created_by", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
        ]);

        const existingMember = existingMemberResult.data?.[0];
        const userOrg = existingOrgResult.data?.[0];
        let orgId: string;

        if (existingMember?.organization_id) {
          orgId = existingMember.organization_id;
          setCurrentOrganizationId(orgId);
          
          // Check brand knowledge in background (non-blocking)
          if (currentStep === "completed") {
            supabase
              .from("brand_knowledge")
              .select("id")
              .eq("organization_id", orgId)
              .limit(1)
              .then(({ data: brandKnowledge }) => {
                if (!brandKnowledge || brandKnowledge.length === 0) {
                  setShowBanner(true);
                }
              })
              .catch(err => logger.error("Error checking brand knowledge:", err));
          }
        } else if (userOrg) {
          // User already has an organization, use it (always use the first/oldest one)
          orgId = userOrg.id;
          logger.debug("Found existing organization:", orgId);
          setCurrentOrganizationId(orgId);
          
          // Use upsert to avoid conflicts - will insert if not exists, update if exists
          // Run in background (non-blocking)
          supabase
            .from("organization_members")
            .upsert({
              organization_id: orgId,
              user_id: user.id,
              role: "owner",
            }, {
              onConflict: 'user_id,organization_id',
              ignoreDuplicates: true
            })
            .then(({ error: memberError }) => {
              if (memberError) {
                logger.error("Failed to ensure user is organization member:", memberError);
              }
            });
          
          // Check brand knowledge in background (non-blocking)
          if (currentStep === "completed") {
            supabase
              .from("brand_knowledge")
              .select("id")
              .eq("organization_id", orgId)
              .limit(1)
              .then(({ data: brandKnowledge }) => {
                if (!brandKnowledge || brandKnowledge.length === 0) {
                  setShowBanner(true);
                }
              })
              .catch(err => logger.error("Error checking brand knowledge:", err));
          }
        } else {
          // Create personal organization
          logger.debug("Creating new organization for user");
          const { data: newOrg, error: orgError } = await supabase
            .from("organizations")
            .insert({
              name: `${user.email?.split("@")[0]}'s Workspace`,
              created_by: user.id,
            })
            .select()
            .single();

          if (orgError) {
            logger.error("Failed to create organization:", orgError);
            throw orgError;
          }
          
          orgId = newOrg.id;
          setCurrentOrganizationId(orgId);

          // Membership must exist before brand_collections — the brand_collections
          // INSERT policy checks org membership, so running these in parallel races.
          const { error: memberError } = await supabase
            .from("organization_members")
            .insert({
              organization_id: orgId,
              user_id: user.id,
              role: "owner",
            });
          if (memberError) {
            logger.error("Failed to add user as organization owner:", memberError);
            throw memberError;
          }

          const { error: collectionError } = await supabase
            .from("brand_collections")
            .insert({
              organization_id: orgId,
              name: "General",
              description: "Default collection for getting started",
              sort_order: 1,
            });
          if (collectionError) {
            logger.error("Failed to create default collection:", collectionError);
          }
        }

        // Show appropriate UI based on step
        if (currentStep === "welcome_pending") {
          setShowWelcome(true);
        } else if (currentStep === "document_pending") {
          setShowDocumentUpload(true);
        } else if (currentStep === "first_generation_pending") {
          setShowForgeGuide(true);
        }
      } catch (error) {
        logger.error("[useOnboarding] Error checking onboarding status:", error);
        // On error, mark as completed to not block the user
        setOnboardingStep("completed");
        if (user) {
          localStorage.setItem(`onboarding_step_${user.id}`, "completed");
        }
      } finally {
        logger.debug("[useOnboarding] Onboarding check complete, setting loading to false");
        setIsLoading(false);
      }
    };

    // Reduced safety timeout for faster initial load
    const safetyTimeout = setTimeout(() => {
      logger.warn("[useOnboarding] Safety timeout reached, forcing loading to false");
      setIsLoading(false);
    }, 1000); // Reduced from 2000ms for faster page load

    checkOnboardingStatus().finally(() => {
      clearTimeout(safetyTimeout);
    });

    return () => clearTimeout(safetyTimeout);
  }, [user]);

  const completeWelcome = async (data: {
    brandName: string;
    industry: string;
    primaryColor: string;
    businessType?: string;
  }) => {
    if (!user || !currentOrganizationId) return;

    try {
      // Get industry template configuration
      const industryTemplate = getIndustryTemplate(data.industry);
      
      // Update organization with brand info, industry configuration, and business type
      await supabase
        .from("organizations")
        .update({
          name: data.brandName,
          business_type: data.businessType || 'finished_goods',
          brand_config: {
            industry: data.industry,
            primaryColor: data.primaryColor,
            industry_config: {
              id: industryTemplate.id,
              name: industryTemplate.name,
              section_title: industryTemplate.section_title,
              fields: industryTemplate.fields,
            },
          },
        })
        .eq("id", currentOrganizationId);

      // Move to document upload step
      setOnboardingStep("document_pending");
      localStorage.setItem(`onboarding_step_${user.id}`, "document_pending");
      setShowWelcome(false);
      setShowDocumentUpload(true);
    } catch (error) {
      logger.error("Error completing welcome:", error);
    }
  };

  const completeDocumentUpload = () => {
    if (!user) return;
    
    // Move to create guide step
    setOnboardingStep("first_generation_pending");
    localStorage.setItem(`onboarding_step_${user.id}`, "first_generation_pending");
    setShowDocumentUpload(false);
    setShowForgeGuide(true);
  };

  const skipDocumentUpload = () => {
    if (!user) return;
    
    // Move to first_generation_pending (same as completeDocumentUpload)
    setOnboardingStep("first_generation_pending");
    localStorage.setItem(`onboarding_step_${user.id}`, "first_generation_pending");
    setShowDocumentUpload(false);
    setShowForgeGuide(true);
  };

  const completeFirstGeneration = () => {
    if (!user) return;
    
    // Mark onboarding as complete
    setOnboardingStep("completed");
    localStorage.setItem(`onboarding_step_${user.id}`, "completed");
    localStorage.setItem(`onboarding_completed_${user.id}`, "true");
    setShowForgeGuide(false);
    setShowCompleteModal(true);
  };

  const closeCompleteModal = () => {
    setShowCompleteModal(false);
  };

  const dismissBanner = () => {
    if (!user) return;
    localStorage.setItem(`banner_dismissed_${user.id}`, "true");
    setShowBanner(false);
  };

  return {
    showWelcome,
    showDocumentUpload,
    showForgeGuide,
    showCompleteModal,
    showBanner,
    currentOrganizationId,
    isLoading,
    onboardingStep,
    completeWelcome,
    completeDocumentUpload,
    skipDocumentUpload,
    completeFirstGeneration,
    closeCompleteModal,
    dismissBanner,
  };
}
