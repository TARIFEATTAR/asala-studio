import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Returns the organization ID the current user should operate against.
 * ENFORCES ONE ORGANIZATION PER USER - will always return the same org.
 * Prefers an existing membership entry, falls back to organizations created
 * by the user, and only creates a new organization if absolutely none exist.
 */
export async function getOrCreateOrganizationId(userId: string) {
  // 1) Check existing membership (get the first one, ordered by creation)
  const { data: members, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (memberError) {
    logger.error("[getOrCreateOrganizationId] Error fetching membership:", memberError);
    throw memberError;
  }

  if (members && members.length > 0 && members[0].organization_id) {
    logger.debug("[getOrCreateOrganizationId] Found existing membership:", members[0].organization_id);
    return members[0].organization_id;
  }

  // 2) Fallback to organizations the user created (get the FIRST one created)
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("created_by", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgError) {
    logger.error("[getOrCreateOrganizationId] Error fetching organizations:", orgError);
    throw orgError;
  }

  if (orgs && orgs.length > 0 && orgs[0].id) {
    logger.debug("[getOrCreateOrganizationId] Found existing org by created_by:", orgs[0].id);
    await ensureMembership(userId, orgs[0].id);
    return orgs[0].id;
  }

  // 3) ONLY create a new organization if user has NO organizations at all
  logger.debug("[getOrCreateOrganizationId] No existing org found, creating new one for user:", userId);
  
  const { data: newOrg, error: createError } = await supabase
    .from("organizations")
    .insert({
      name: `${userId.slice(0, 6)}'s Workspace`,
      created_by: userId,
    })
    .select()
    .single();

  if (createError || !newOrg?.id) {
    logger.error("[getOrCreateOrganizationId] Error creating organization:", createError);
    throw createError ?? new Error("Failed to create organization");
  }

  await ensureMembership(userId, newOrg.id);
  logger.debug("[getOrCreateOrganizationId] Created new org:", newOrg.id);

  return newOrg.id;
}

async function ensureMembership(userId: string, organizationId: string) {
  const { error } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        role: "owner",
      },
      {
        onConflict: "organization_id,user_id",
        ignoreDuplicates: true,
      }
    );
  if (error) {
    logger.error("[ensureMembership] Failed to upsert membership:", error);
    throw error;
  }
}











