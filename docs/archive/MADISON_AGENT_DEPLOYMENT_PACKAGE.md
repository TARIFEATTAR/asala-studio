# MADISON AGENT - Deployment Package Checklist
## Complete File List for Agent Deployment

This document lists all files, data, and resources needed to deploy Madison as a standalone agent.

---

## 📦 CORE TRAINING FILES

### 1. Author Profiles (Copywriting Expertise)
**Location:** `prompts/authors/`

- [x] `halbert.md` - Gary Halbert (Urgency with substance)
- [x] `ogilvy.md` - David Ogilvy (Specificity & proof)
- [x] `hopkins.md` - Claude Hopkins (Reason-why architecture)
- [x] `schwartz.md` - Eugene Schwartz (Awareness strategy)
- [x] `collier.md` - Robert Collier (Conversation hook)
- [x] `peterman.md` - J. Peterman (Narrative storytelling)
- [x] `joyner.md` - Mark Joyner (Irresistible simplifier)
- [x] `caples.md` - John Caples (Tested headlines)
- [x] `peterman_quick_reference.md` - Peterman cheat sheet
- [x] `peterman_complete.md` - Complete Peterman training
- [x] `peterman_transformations.md` - Transformation examples
- [x] `peterman_style_engine.json` - Peterman style engine data
- [x] `README.md` - Authors directory documentation

### 2. Brand Intelligence Authorities
**Location:** `prompts/brand-authorities/`

- [x] `wheeler.md` - Alina Wheeler (Visual identity systems)
- [x] `neumeier.md` - Marty Neumeier (Brand positioning)
- [x] `clow.md` - Lee Clow (Brand campaigns)
- [x] `README.md` - Brand authorities documentation

### 3. Core Training Documents
**Location:** `prompts/`

- [x] `madison_core_v1.md` - Core training document
- [x] `madison_hybrid_engine.md` - Hybrid approach
- [x] `madison_style_matrix.md` - Style selection matrix
- [x] `madison_templates.md` - Content templates
- [x] `madison_training_set.md` - Training set examples

### 4. Visual Direction
**Location:** `src/knowledge/`

- [x] `madison-visual-direction.md` - Visual direction guide
- [x] `photography-ontology.json` - Photography schema

### 5. Category-Specific Guides
**Location:** `prompts/categories/`

- [x] `fragrance.md` - Fragrance category guide
- [x] `skincare.md` - Skincare category guide

---

## 💾 DATABASE DATA (Export Required)

### 1. System Configuration
**Table:** `madison_system_config`

**Fields to Export:**
- `persona` - Madison's core identity
- `editorial_philosophy` - Fundamental beliefs
- `writing_influences` - Writing influences
- `voice_spectrum` - Available voice ranges
- `forbidden_phrases` - Banned words/phrases
- `quality_standards` - Quality benchmarks

**Export Format:** JSON or SQL dump

### 2. Training Documents
**Table:** `madison_training_documents`

**Fields to Export:**
- `file_name` - Document name
- `extracted_content` - Processed content
- `category` - Document category (writing_style, visual_identity, etc.)
- `processing_status` - Status (should be 'completed')

**Export Format:** JSON array with all completed documents

---

## 📚 REFERENCE DOCUMENTATION

### 1. Master Reference
- [x] `MADISON_MASTER_REFERENCE.md` - Complete feature reference

### 2. Product Requirements
- [x] `docs/MADISON-PRD.md` - Product requirements document

### 3. Training Status
- [x] `docs/MADISON_TRAINING_STATUS.md` - Training status
- [x] `BRAND_INTELLIGENCE_STATUS.md` - Brand intelligence status

### 4. Agent Training (This Package)
- [x] `MADISON_AGENT_TRAINING_COMPLETE.md` - Complete training doc
- [x] `MADISON_AGENT_DEPLOYMENT_PACKAGE.md` - This file

---

## 🔧 CODE INTEGRATION FILES

### 1. Shared Modules
**Location:** `supabase/functions/_shared/`

- [x] `authorProfiles.ts` - Author profiles module
- [x] `brandAuthorities.ts` - Brand authorities module
- [x] `petermanStyleEngine.ts` - Peterman style engine

### 2. Edge Function Examples
**Location:** `supabase/functions/`

- [x] `generate-with-claude/index.ts` - Main generation function
- [x] `think-mode-chat/index.ts` - Chat/conversation function
- [x] `repurpose-content/index.ts` - Content repurposing function
- [x] `marketplace-assistant/index.ts` - Marketplace assistant

**Note:** These are reference implementations showing how to integrate Madison's training data.

---

## 📋 DEPLOYMENT CHECKLIST

### Phase 1: File Collection
- [ ] Copy all author profile files
- [ ] Copy all brand authority files
- [ ] Copy core training documents
- [ ] Copy visual direction files
- [ ] Copy category-specific guides

### Phase 2: Data Export
- [ ] Export `madison_system_config` table data
- [ ] Export `madison_training_documents` table data
- [ ] Verify all fields are populated
- [ ] Convert to appropriate format (JSON/SQL)

### Phase 3: Documentation
- [ ] Include `MADISON_AGENT_TRAINING_COMPLETE.md`
- [ ] Include this deployment package checklist
- [ ] Include master reference (optional)
- [ ] Create deployment instructions

### Phase 4: Integration Code
- [ ] Extract author profiles loading logic
- [ ] Extract brand authorities loading logic
- [ ] Extract system config loading logic
- [ ] Create agent initialization function
- [ ] Create prompt building function

### Phase 5: Testing
- [ ] Test agent initialization
- [ ] Test prompt building
- [ ] Test content generation
- [ ] Test brand intelligence
- [ ] Verify output formatting
- [ ] Validate quality standards

---

## 🎯 QUICK START GUIDE

### For Agent Developers

1. **Load Training Data:**
   - Load all author profiles from `prompts/authors/*.md`
   - Load all brand authorities from `prompts/brand-authorities/*.md`
   - Load system config from database export
   - Load training documents from database export

2. **Build System Prompt:**
   - Start with persona from system config
   - Add editorial philosophy
   - Append all author profiles
   - Append all brand authorities
   - Add client brand knowledge (if available)
   - Add quality standards and forbidden phrases

3. **Initialize Agent:**
   - Set model (Claude Sonnet 4 recommended)
   - Configure temperature (0.7 for generation, 0.3 for curation)
   - Set max tokens (4096)
   - Enable retry logic (3 attempts, exponential backoff)

4. **Generate Content:**
   - Provide task/brief
   - Include brand context
   - Specify content type
   - Select author style (if applicable)
   - Request generation

5. **Validate Output:**
   - Check for banned words
   - Verify specificity
   - Confirm brand alignment
   - Validate formatting (plain text only)

---

## 📊 FILE SIZE ESTIMATES

**Author Profiles:** ~50KB total
**Brand Authorities:** ~20KB total
**Core Training:** ~30KB total
**Visual Direction:** ~15KB total
**System Config (DB):** ~10KB
**Training Documents (DB):** Variable (typically 50-200KB)

**Total Package:** ~200-400KB (excluding training documents)

---

## 🔐 SECURITY CONSIDERATIONS

### Data Privacy
- Remove any client-specific data from training files
- Anonymize examples in training documents
- Ensure no PII in exported data

### API Keys
- Do NOT include API keys in deployment package
- Provide instructions for key configuration
- Use environment variables for keys

### Access Control
- Implement proper authentication
- Use role-based access if needed
- Log all agent interactions

---

## 🚀 DEPLOYMENT OPTIONS

### Option 1: Standalone Agent
- Deploy as independent service
- Use provided training data
- Implement custom API

### Option 2: API Wrapper
- Wrap existing AI service (Claude/GPT)
- Inject Madison training data
- Provide unified interface

### Option 3: Plugin/Extension
- Integrate into existing platform
- Use Madison as content generation module
- Maintain brand intelligence capabilities

---

## 📝 VERSION INFORMATION

**Agent Version:** 2.0
**Training Data Version:** 1.0
**Last Updated:** January 2025
**Compatibility:** Claude Sonnet 4, GPT-4, Gemini 2.0

---

## ✅ FINAL CHECKLIST

Before deploying, ensure:

- [ ] All training files collected
- [ ] Database data exported
- [ ] Documentation complete
- [ ] Integration code ready
- [ ] Testing completed
- [ ] Security reviewed
- [ ] Deployment instructions written
- [ ] Support documentation prepared

---

**END OF DEPLOYMENT PACKAGE**

This checklist ensures all necessary files and data are included for successful Madison agent deployment.




