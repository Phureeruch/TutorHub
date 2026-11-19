#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TutorHub — Google Cloud Run & Cloud SQL Teardown Script
# ==============================================================================
# Usage:
#   ./deploy/teardown.sh
#
# Environment Variables (Optional):
#   PROJECT_ID   GCP Project ID (defaults to active gcloud config project)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES
#   Deletes everything deploy/deploy.sh created (Cloud Run service + job, Cloud
#   SQL, Artifact Registry, secrets, service account) to stop billing.
#
# ⚠️ DESTRUCTIVE: all Cloud SQL data is permanently lost. You must type the
#    project ID to confirm. Preview first with:  DRY_RUN=1 ./deploy/teardown.sh
#
# REFERENCES
#   - gcloud run services delete  : https://cloud.google.com/sdk/gcloud/reference/run/services/delete
#   - gcloud sql instances delete : https://cloud.google.com/sdk/gcloud/reference/sql/instances/delete
#   - gcloud secrets delete       : https://cloud.google.com/sdk/gcloud/reference/secrets/delete
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Resource names
# ------------------------------------------------------------------------------
REPO_NAME="tutorhub"
SQL_INSTANCE="tutorhub-pg"
SERVICE_NAME="tutorhub"
MIGRATE_JOB_NAME="tutorhub-migrate"
SA_NAME="tutorhub-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

SECRET_DB_URL="tutorhub-database-url"
SECRET_ADMIN_PASS="tutorhub-admin-password"
SECRET_DEMO_PASS="tutorhub-demo-password"
SECRET_JWT="tutorhub-jwt-secret"

echo "=================================================================="
echo "WARNING: This will permanently delete TutorHub resources in:"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "Resources to be deleted:"
echo "  - Cloud Run Service : ${SERVICE_NAME}"
echo "  - Cloud Run Job     : ${MIGRATE_JOB_NAME}"
echo "  - Cloud SQL Instance: ${SQL_INSTANCE} (ALL DATABASE DATA WILL BE LOST)"
echo "  - Artifact Registry : ${REPO_NAME}"
echo "  - Secrets           : ${SECRET_DB_URL}, ${SECRET_ADMIN_PASS}, ${SECRET_DEMO_PASS}, ${SECRET_JWT}"
echo "  - Service Account   : ${SA_EMAIL}"
echo "=================================================================="

# ------------------------------------------------------------------------------
# Safety confirmation (skipped only in DRY_RUN)
# ------------------------------------------------------------------------------
if [ "$DRY_RUN" != "1" ]; then
  read -r -p "Type the project ID (${PROJECT_ID}) to confirm deletion: " CONFIRM_PROJECT
  if [ "$CONFIRM_PROJECT" != "$PROJECT_ID" ]; then
    echo "Aborted: confirmation did not match ${PROJECT_ID}."
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Delete resources (each `|| true` so one missing resource does not stop the rest)
# ------------------------------------------------------------------------------
run_cmd gcloud run services delete "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud run jobs delete "$MIGRATE_JOB_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud sql instances delete "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud artifacts repositories delete "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DB_URL" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_ADMIN_PASS" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DEMO_PASS" --project "$PROJECT_ID" --quiet || true

# Ownership-safe deletion of JWT secret: verify ownership labels before deletion
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_JWT" --project "$PROJECT_ID"
  run_cmd gcloud secrets delete "$SECRET_JWT" --project "$PROJECT_ID" --quiet || true
else
  JWT_TEARDOWN_OUT=""
  if ! JWT_TEARDOWN_OUT="$(gcloud secrets describe "$SECRET_JWT" --project "$PROJECT_ID" --format="value(labels.app,labels.managed-by)" 2>&1)"; then
    if echo "$JWT_TEARDOWN_OUT" | grep -Eq 'ERROR: \(gcloud\.secrets\.describe\) NOT_FOUND:'; then
      echo "Notice: Secret '${SECRET_JWT}' does not exist in project '${PROJECT_ID}'. Skipping deletion."
    else
      echo "ERROR: Failed to retrieve metadata for secret '${SECRET_JWT}' in project '${PROJECT_ID}': ${JWT_TEARDOWN_OUT}. Skipping deletion to prevent data loss." >&2
    fi
  else
    JWT_TEARDOWN_OUT="${JWT_TEARDOWN_OUT%$'\r'}"
    APP_LABEL=""
    MANAGED_BY_LABEL=""
    IFS=$'\t' read -r APP_LABEL MANAGED_BY_LABEL <<< "$JWT_TEARDOWN_OUT"
    if [ "$APP_LABEL" = "tutorhub" ] && [ "$MANAGED_BY_LABEL" = "tutorhub-deploy" ]; then
      run_cmd gcloud secrets delete "$SECRET_JWT" --project "$PROJECT_ID" --quiet || true
    else
      echo "WARNING: Secret '${SECRET_JWT}' in project '${PROJECT_ID}' does not have matching ownership labels (expected app=tutorhub, managed-by=tutorhub-deploy; found app='${APP_LABEL}', managed-by='${MANAGED_BY_LABEL}'). Skipping deletion." >&2
    fi
  fi
fi

run_cmd gcloud iam service-accounts delete "$SA_EMAIL" --project "$PROJECT_ID" --quiet || true

echo "Teardown completed."
