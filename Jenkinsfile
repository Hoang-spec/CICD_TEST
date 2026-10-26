pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timestamps()
  }

  parameters {
    string(name: 'DEPLOY_HOST', defaultValue: '', description: 'Production server hostname or IP; leave empty to build and push only')
    string(name: 'DEPLOY_USER', defaultValue: 'ubuntu', description: 'SSH user on the production server')
    string(name: 'DEPLOY_DIR', defaultValue: '/opt/material-kit-react', description: 'Deployment directory on the production server')
    string(name: 'CLIENT_ORIGIN', defaultValue: '', description: 'Public frontend origin, for example https://shop.example.com')
  }

  environment {
    DOCKERHUB_CREDENTIALS = 'dockerhub-cred'
    SSH_CREDENTIALS = 'server-ssh-key'
    DATABASE_CREDENTIALS = 'postgres-password'
    IMAGE_TAG = "${env.GIT_COMMIT?.take(12) ?: env.BUILD_NUMBER}"
  }

  stages {
    stage('Validate') {
      steps {
        sh '''
          npm ci
          npm run typecheck
          (cd backend && npm ci && node --check src/server.js)
        '''
      }
    }

    stage('Build images') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            docker build --pull -t "$DOCKER_USER/material-kit-react-frontend:$IMAGE_TAG" -t "$DOCKER_USER/material-kit-react-frontend:latest" --build-arg API_INTERNAL_URL=http://backend:4000 .
            docker build --pull -t "$DOCKER_USER/material-kit-react-backend:$IMAGE_TAG" -t "$DOCKER_USER/material-kit-react-backend:latest" ./backend
            printf '%s' "$DOCKER_PASS" | docker login --username "$DOCKER_USER" --password-stdin
            docker push "$DOCKER_USER/material-kit-react-frontend:$IMAGE_TAG"
            docker push "$DOCKER_USER/material-kit-react-frontend:latest"
            docker push "$DOCKER_USER/material-kit-react-backend:$IMAGE_TAG"
            docker push "$DOCKER_USER/material-kit-react-backend:latest"
            docker logout
          '''
        }
      }
    }

    stage('Deploy') {
      when {
        expression { params.DEPLOY_HOST?.trim() }
      }
      steps {
        withCredentials([
          usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS'),
          string(credentialsId: env.DATABASE_CREDENTIALS, variable: 'POSTGRES_PASSWORD'),
          string(credentialsId: 'admin-email', variable: 'ADMIN_EMAIL'),
          string(credentialsId: 'admin-password', variable: 'ADMIN_PASSWORD'),
          sshUserPrivateKey(credentialsId: env.SSH_CREDENTIALS, keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_CREDENTIAL_USER')
        ]) {
          sh '''
            set -eu
            test -n "$CLIENT_ORIGIN" || { echo 'Set CLIENT_ORIGIN before deployment' >&2; exit 2; }
            case "$POSTGRES_PASSWORD" in *[!a-zA-Z0-9_-]*|'') echo 'postgres-password must use URL-safe letters, numbers, underscores or hyphens' >&2; exit 2;; esac
            DEPLOY_USER="${DEPLOY_USER:-$SSH_CREDENTIAL_USER}"
            SSH_OPTS="-i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
            REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
            ssh $SSH_OPTS "$REMOTE" "mkdir -p '$DEPLOY_DIR'"
            umask 077
            ADMIN_PASSWORD_B64=$(printf '%s' "$ADMIN_PASSWORD" | base64 | tr -d '\n')
            printf 'DOCKERHUB_USERNAME=%s\nIMAGE_TAG=%s\nPOSTGRES_PASSWORD=%s\nADMIN_EMAIL=%s\nADMIN_PASSWORD_B64=%s\nCLIENT_ORIGIN=%s\n' "$DOCKER_USER" "$IMAGE_TAG" "$POSTGRES_PASSWORD" "$ADMIN_EMAIL" "$ADMIN_PASSWORD_B64" "$CLIENT_ORIGIN" > .deploy.env
            scp $SSH_OPTS docker-compose.prod.yml "$REMOTE:$DEPLOY_DIR/docker-compose.yml"
            scp $SSH_OPTS .deploy.env "$REMOTE:$DEPLOY_DIR/.env"
            rm -f .deploy.env
            printf '%s' "$DOCKER_PASS" | ssh $SSH_OPTS "$REMOTE" "docker login --username '$DOCKER_USER' --password-stdin"
            ssh $SSH_OPTS "$REMOTE" "cd '$DEPLOY_DIR' && docker compose pull && docker compose up -d --force-recreate --remove-orphans && docker image prune -f"
            ssh $SSH_OPTS "$REMOTE" 'docker logout'
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'docker logout >/dev/null 2>&1 || true'
      cleanWs()
    }
  }
}
