#!/usr/bin/env bash
# Offline regression checks: every gcloud and openssl call is a local stub.
# ==============================================================================
# WHAT THIS TEST DOES (no real GCP calls, no cost)
#   Puts fake `gcloud` / `openssl` first on PATH and runs deploy/deploy.sh in
#   these scenarios, asserting on the recorded commands:
#     first_run : nothing exists      -> everything is created
#     rerun     : everything exists   -> nothing replaced (credentials kept)
#     partial   : DB secret missing   -> DB user password reset + secret created
#     job-fail  : migration fails     -> script exits 1, service NOT deployed
#     demo      : --demo flag         -> demo secret is created and granted
#   It also checks: `--edition=enterprise`, no project-wide secretAccessor role,
#   DB password == password inside DATABASE_URL, and that no password/secret
#   value leaks into the output. Finally DRY_RUN=1 must make zero gcloud calls.
#
# HOW TO RUN (repo root, needs bash):  bash deploy/tests/test_deploy_stub.sh
#   Prints `PASS: <scenario>` per scenario; any `FAIL ...` exits non-zero.
#   CI runs it too (.github/workflows/ci-docker.yml).
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
TEARDOWN_SCRIPT="${SCRIPT_DIR}/../teardown.sh"
export TEST_STATE_DIR
TEST_STATE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_STATE_DIR"' EXIT
mkdir -p "$TEST_STATE_DIR/bin"

# --- Fake `openssl` (deterministic "random" values) ---------------------------
cat > "$TEST_STATE_DIR/bin/openssl" <<'STUB'
#!/usr/bin/env bash
if [ "$2" = "-hex" ]; then
  printf '%s\n' '0123456789abcdef0123456789abcdef0123456789abcdef'
else
  printf '%s\n' 'TESTONLYGENERATEDPASSWORD'
fi
STUB

# --- Fake `gcloud`: logs each call (password redacted), answers per $STUB_MODE
cat > "$TEST_STATE_DIR/bin/gcloud" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
redacted=()
for arg in "$@"; do
  case "$arg" in
    --password=*)
      printf '%s' "${arg#--password=}" > "$TEST_STATE_DIR/sql-pass"
      redacted+=("--password=<REDACTED>") ;;
    *) redacted+=("$arg") ;;
  esac
done
printf '%s\n' "${redacted[*]}" >> "$GCLOUD_LOG"
if [ "${1:-} ${2:-}" = 'config get-value' ]; then
  echo stub-gcp-project
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'run services describe' ]; then
  echo https://tutorhub-stub.example.invalid
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'run jobs execute' ]; then
  [ "$STUB_MODE" != job-fail ]
  exit $?
fi
if [ "${1:-} ${2:-} ${3:-}" = 'secrets versions add' ]; then
  cat > "$TEST_STATE_DIR/payload-${4}"
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'sql users list' ]; then
  if [ "$STUB_MODE" = first_run ]; then
    echo postgres
  else
    printf 'postgres\ntutorhub\n'
  fi
  exit 0
fi
if [ "${1:-} ${2:-}" = 'secrets describe' ]; then
  secret="${3:-}"
  if [ "$secret" = 'tutorhub-jwt-secret' ]; then
    if [ -n "${TEARDOWN_JWT_STATE:-}" ]; then
      case "$TEARDOWN_JWT_STATE" in
        missing)
          echo "ERROR: (gcloud.secrets.describe) NOT_FOUND: Resource '${secret}' was not found." >&2
          exit 1 ;;
        describe_error)
          echo "ERROR: (gcloud.secrets.describe) PERMISSION_DENIED: Permission 'secretmanager.secrets.get' denied on resource '${secret}'." >&2
          exit 1 ;;
        unrelated_not_found)
          echo "ERROR: (gcloud.secrets.describe) PERMISSION_DENIED: Service account not found in project." >&2
          exit 1 ;;
        no_labels)
          for arg in "$@"; do
            case "$arg" in
              --format=*) printf '\n'; exit 0 ;;
            esac
          done
          exit 0 ;;
        other_labels)
          for arg in "$@"; do
            case "$arg" in
              --format=*labels.app,labels.managed-by*|--format=*labels.app*labels.managed-by*)
                printf '%s\t%s\n' "other-service" "manual"
                exit 0 ;;
              --format=*labels.app*) echo "other-service"; exit 0 ;;
              --format=*labels.managed-by*) echo "manual"; exit 0 ;;
              --format=*) printf '\n'; exit 0 ;;
            esac
          done
          exit 0 ;;
        owned)
          for arg in "$@"; do
            case "$arg" in
              --format=*labels.app,labels.managed-by*|--format=*labels.app*labels.managed-by*)
                printf '%s\t%s\n' "tutorhub" "tutorhub-deploy"
                exit 0 ;;
              --format=*labels.app*) echo "tutorhub"; exit 0 ;;
              --format=*labels.managed-by*) echo "tutorhub-deploy"; exit 0 ;;
              --format=*) printf '\n'; exit 0 ;;
            esac
          done
          exit 0 ;;
      esac
    fi

    case "${STUB_MODE:-}" in
      existing_unlabeled)
        for arg in "$@"; do
          case "$arg" in
            --format=*) printf '\n'; exit 0 ;;
          esac
        done
        exit 0 ;;
      existing_wrong_labels)
        for arg in "$@"; do
          case "$arg" in
            --format=*labels.app,labels.managed-by*|--format=*labels.app*labels.managed-by*)
              printf '%s\t%s\n' "foreign-app" "manual"
              exit 0 ;;
            --format=*labels.app*) echo "foreign-app"; exit 0 ;;
            --format=*labels.managed-by*) echo "manual"; exit 0 ;;
            --format=*) printf '\n'; exit 0 ;;
          esac
        done
        exit 0 ;;
      describe_error)
        echo "ERROR: (gcloud.secrets.describe) PERMISSION_DENIED: Permission 'secretmanager.secrets.get' denied on resource '${secret}'." >&2
        exit 1 ;;
      unrelated_not_found)
        echo "ERROR: (gcloud.secrets.describe) PERMISSION_DENIED: Service account not found in project." >&2
        exit 1 ;;
      first_run)
        echo "ERROR: (gcloud.secrets.describe) NOT_FOUND: Resource '${secret}' was not found." >&2
        exit 1 ;;
      *)
        for arg in "$@"; do
          case "$arg" in
            --format=*labels.app,labels.managed-by*|--format=*labels.app*labels.managed-by*)
              printf '%s\t%s\n' "tutorhub" "tutorhub-deploy"
              exit 0 ;;
            --format=*labels.app*) echo "tutorhub"; exit 0 ;;
            --format=*labels.managed-by*) echo "tutorhub-deploy"; exit 0 ;;
            --format=*) printf '\n'; exit 0 ;;
          esac
        done
        exit 0 ;;
    esac
  fi
fi
for word in "$@"; do
  if [ "$word" = describe ]; then
    case "$STUB_MODE" in
      first_run) exit 1 ;;
      partial)
        if [ "${1:-} ${3:-}" = 'secrets tutorhub-database-url' ]; then
          exit 1
        fi ;;
    esac
  fi
done
STUB
chmod +x "$TEST_STATE_DIR/bin/openssl" "$TEST_STATE_DIR/bin/gcloud"
export PATH="$TEST_STATE_DIR/bin:$PATH"
export PROJECT_ID=stub-gcp-project
export REGION=asia-southeast1
export DRY_RUN=0

# --- Run every scenario and assert on what deploy.sh did ------------------------
for MODE in first_run rerun partial job-fail demo; do
  export STUB_MODE="$MODE"
  [ "$MODE" != demo ] || export STUB_MODE=first_run
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-$MODE.log"
  rm -f "$TEST_STATE_DIR/sql-pass" "$TEST_STATE_DIR"/payload-*
  args=()
  if [ "$MODE" = demo ]; then args+=(--demo); fi
  result=0
  bash "$DEPLOY_SCRIPT" ${args[@]+"${args[@]}"} > "$TEST_STATE_DIR/output" 2>&1 || result=$?
  expected=0
  if [ "$MODE" = job-fail ]; then expected=1; fi
  if [ "$result" -ne "$expected" ]; then
    echo "FAIL $MODE: unexpected exit $result (wanted $expected)"
    exit 1
  fi
  if [ "$MODE" = job-fail ]; then
    if grep -q '^run deploy ' "$GCLOUD_LOG"; then
      echo 'FAIL: service deployed after migration failure'; exit 1
    fi
  else
    grep -q '^run deploy ' "$GCLOUD_LOG"
    grep '^run deploy ' "$GCLOUD_LOG" | grep -q -- '--set-secrets DATABASE_URL=tutorhub-database-url:latest,JWT_SECRET=tutorhub-jwt-secret:latest'
  fi
  if grep -q '^projects add-iam-policy-binding .*roles/secretmanager.secretAccessor' "$GCLOUD_LOG"; then
    echo 'FAIL: runtime has project-wide secret access'; exit 1
  fi
  for secret in tutorhub-database-url tutorhub-admin-password tutorhub-jwt-secret; do
    grep -q "^secrets add-iam-policy-binding $secret .*roles/secretmanager.secretAccessor" "$GCLOUD_LOG"
  done
  if [ "$MODE" = demo ]; then
    grep -q '^secrets add-iam-policy-binding tutorhub-demo-password ' "$GCLOUD_LOG"
  elif grep -q '^secrets add-iam-policy-binding tutorhub-demo-password ' "$GCLOUD_LOG"; then
    echo 'FAIL: granted optional demo secret in non-demo mode'; exit 1
  fi
  case "$MODE" in
    first_run)
      grep -q -- '--edition=enterprise' "$GCLOUD_LOG"
      grep -q '^sql users create ' "$GCLOUD_LOG"
      grep -q '^secrets create tutorhub-jwt-secret ' "$GCLOUD_LOG"
      grep -q '^secrets create tutorhub-jwt-secret .*--labels=app=tutorhub,managed-by=tutorhub-deploy' "$GCLOUD_LOG"
      grep -q '^secrets versions add tutorhub-jwt-secret ' "$GCLOUD_LOG" ;;
    partial) grep -q '^sql users set-password ' "$GCLOUD_LOG" ;;
    rerun)
      if grep -Eq '^(secrets (create|versions add)|sql users (create|set-password)) ' "$GCLOUD_LOG"; then
        echo 'FAIL: rerun replaced existing credentials or added secret versions'; exit 1
      fi ;;
  esac
  if [ -f "$TEST_STATE_DIR/sql-pass" ]; then
    db_pass="$(cat "$TEST_STATE_DIR/sql-pass")"
    db_url="$(cat "$TEST_STATE_DIR/payload-tutorhub-database-url")"
    case "$db_url" in
      "postgresql://tutorhub:${db_pass}@"*) ;;
      *) echo 'FAIL: DB password differs from secret'; exit 1 ;;
    esac
    if grep -Fq "$db_pass" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: DB password leaked to output'; exit 1
    fi
  fi
  for secret_file in "$TEST_STATE_DIR"/payload-*; do
    [ -f "$secret_file" ] || continue
    secret_value="$(cat "$secret_file")"
    if [ -n "$secret_value" ] && grep -Fq "$secret_value" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: secret payload leaked to output'; exit 1
    fi
  done
  echo "PASS: $MODE (exit, migration gate, credential handling, secret redaction)"
done

# --- Deploy JWT secret ownership validation tests -----------------------------
for D_FAIL_MODE in existing_unlabeled existing_wrong_labels describe_error unrelated_not_found; do
  export STUB_MODE="$D_FAIL_MODE"
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-deploy-fail-$D_FAIL_MODE.log"
  output_file="$TEST_STATE_DIR/output-deploy-fail-$D_FAIL_MODE"

  result=0
  bash "$DEPLOY_SCRIPT" > "$output_file" 2>&1 || result=$?
  if [ "$result" -eq 0 ]; then
    echo "FAIL deploy-$D_FAIL_MODE: expected non-zero exit code, got 0"
    exit 1
  fi

  if grep -q '^secrets create tutorhub-jwt-secret ' "$GCLOUD_LOG"; then
    echo "FAIL deploy-$D_FAIL_MODE: unexpectedly attempted to create secret"
    exit 1
  fi
  if grep -q '^run deploy ' "$GCLOUD_LOG"; then
    echo "FAIL deploy-$D_FAIL_MODE: service deployed after ownership check failure"
    exit 1
  fi

  case "$D_FAIL_MODE" in
    existing_unlabeled|existing_wrong_labels)
      if ! grep -q 'does not have expected ownership labels' "$output_file"; then
        echo "FAIL deploy-$D_FAIL_MODE: missing ownership mismatch error message"
        exit 1
      fi ;;
    describe_error|unrelated_not_found)
      if ! grep -q 'Failed to retrieve metadata for secret' "$output_file"; then
        echo "FAIL deploy-$D_FAIL_MODE: missing metadata retrieval failure error message"
        exit 1
      fi ;;
  esac
  echo "PASS: deploy-$D_FAIL_MODE (deployment safely aborted before creation/deploy)"
done

# --- Dry run must not call gcloud at all ------------------------------------------
export GCLOUD_LOG="$TEST_STATE_DIR/dry-run-calls"
DRY_RUN=1 bash "$DEPLOY_SCRIPT" --demo > "$TEST_STATE_DIR/dry-run-output"
if [ -f "$GCLOUD_LOG" ]; then
  echo 'FAIL: dry run called gcloud'; exit 1
fi
echo 'PASS: dry run makes no gcloud calls'

# --- Teardown dry run must not call gcloud ---------------------------------------
export GCLOUD_LOG="$TEST_STATE_DIR/teardown-dry-run-calls"
DRY_RUN=1 bash "$TEARDOWN_SCRIPT" > "$TEST_STATE_DIR/teardown-dry-run-output"
if [ -f "$GCLOUD_LOG" ]; then
  echo 'FAIL: teardown dry run called gcloud'; exit 1
fi
echo 'PASS: teardown dry run makes no gcloud calls'

# --- Teardown ownership safety tests -------------------------------------------
for T_MODE in owned no_labels other_labels missing describe_error unrelated_not_found; do
  export TEARDOWN_JWT_STATE="$T_MODE"
  export STUB_MODE="teardown"
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-teardown-$T_MODE.log"
  output_file="$TEST_STATE_DIR/output-teardown-$T_MODE"

  result=0
  printf '%s\n' "$PROJECT_ID" | bash "$TEARDOWN_SCRIPT" > "$output_file" 2>&1 || result=$?
  if [ "$result" -ne 0 ]; then
    echo "FAIL teardown-$T_MODE: unexpected exit $result (wanted 0)"
    cat "$output_file"
    exit 1
  fi

  case "$T_MODE" in
    owned)
      if ! grep -q '^secrets delete tutorhub-jwt-secret ' "$GCLOUD_LOG"; then
        echo 'FAIL: owned JWT secret was not deleted in teardown'; exit 1
      fi ;;
    no_labels)
      if grep -q '^secrets delete tutorhub-jwt-secret ' "$GCLOUD_LOG"; then
        echo 'FAIL: unlabeled JWT secret was unexpectedly deleted'; exit 1
      fi
      if ! grep -q 'does not have matching ownership labels' "$output_file"; then
        echo 'FAIL: missing warning for unlabeled secret'; exit 1
      fi ;;
    other_labels)
      if grep -q '^secrets delete tutorhub-jwt-secret ' "$GCLOUD_LOG"; then
        echo 'FAIL: foreign-labeled JWT secret was unexpectedly deleted'; exit 1
      fi
      if ! grep -q 'does not have matching ownership labels' "$output_file"; then
        echo 'FAIL: missing warning for foreign-labeled secret'; exit 1
      fi ;;
    missing)
      if grep -q '^secrets delete tutorhub-jwt-secret ' "$GCLOUD_LOG"; then
        echo 'FAIL: missing JWT secret was deleted'; exit 1
      fi
      if ! grep -q 'does not exist' "$output_file"; then
        echo 'FAIL: missing notice for nonexistent secret'; exit 1
      fi ;;
    describe_error|unrelated_not_found)
      if grep -q '^secrets delete tutorhub-jwt-secret ' "$GCLOUD_LOG"; then
        echo "FAIL teardown-$T_MODE: JWT secret was deleted despite describe error"; exit 1
      fi
      if ! grep -q 'Failed to retrieve metadata for secret' "$output_file"; then
        echo "FAIL teardown-$T_MODE: missing warning for describe error"; exit 1
      fi ;;
  esac
  echo "PASS: teardown-$T_MODE (ownership verification, safe handling, warning)"
done
