-- AddColumn: onboardingComplete
-- Default true so existing approved designers are not shown the wizard retroactively.
-- New approvals will have this set to false by the admin approval route.
ALTER TABLE "Designer" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT true;
