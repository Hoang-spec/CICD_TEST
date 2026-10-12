# CI/CD setup for Jenkins and Docker

This repository contains a Next.js frontend and an Express API. Jenkins builds and publishes one Docker image for each service, then can deploy both services to a Linux host with Docker Compose. GitHub Actions runs validation on pushes to `main` and pull requests; Jenkins handles image publishing and deployment.

## Run locally with Docker Compose

From the repository root:

```sh
docker compose up --build -d
```

Open `http://localhost:3000`; the API health endpoint is `http://localhost:4000/api/health`. The API stores its JSON database in a named Docker volume. Set a private `JWT_SECRET` before using this setup outside local development. Local demo accounts are documented in `backend/README.md`.

## Jenkins prerequisites

Install Jenkins with Git, Pipeline, Credentials Binding, and SSH Agent plugins. The Jenkins agent needs Git, Node.js 20+, Docker Engine with permission to build images, and the `cleanWs` step (Workspace Cleanup plugin). The production host needs Docker Engine and the Docker Compose plugin.

Create these Jenkins credentials:

| ID | Kind | Value |
| --- | --- | --- |
| `dockerhub-cred` | Username with password | Docker Hub username and access token |
| `server-ssh-key` | SSH Username with private key | Key authorized on the production host |
| `jwt-secret` | Secret text | Long random signing secret |
| `admin-email` | Secret text | Initial production administrator email |
| `admin-password` | Secret text | Strong initial production administrator password |

Create a Pipeline or Multibranch Pipeline job for this GitHub repository, using the `main` branch and the checked-in `Jenkinsfile`. For a standard Pipeline job, choose “Pipeline script from SCM” and point it at this repository; configure repository credentials on the job if it is private. Add the GitHub webhook URL `https://<jenkins-host>/github-webhook/` with JSON content type and push events (use HTTPS and make Jenkins reachable from GitHub).

## Build and deploy

Run the Jenkins job. With `DEPLOY_HOST` empty, it validates the app and pushes tagged plus `latest` frontend and backend images to Docker Hub. To deploy, set:

| Parameter | Example |
| --- | --- |
| `PUBLIC_API_URL` | `https://api.example.com` or `http://<server-ip>:4000` |
| `DEPLOY_HOST` | Public hostname or IP of the production host |
| `DEPLOY_USER` | SSH account on that host |
| `DEPLOY_DIR` | `/opt/material-kit-react` |
| `CLIENT_ORIGIN` | `https://shop.example.com` |

The `PUBLIC_API_URL` value is compiled into the frontend image and must be reachable by users' browsers. `CLIENT_ORIGIN` must exactly match the frontend origin. Open the configured frontend and backend ports on the host (defaults: 3000 and 4000), or place a TLS reverse proxy in front and adjust the port parameters in the server `.env` file.

On the first production start, the API creates its database volume and creates the administrator account from Jenkins credentials. The production image does not create the repository's demo accounts. Keep the credentials stable after initialization: changing the Jenkins admin password does not update an existing account in the persisted JSON database. Back up the `backend-data` Docker volume before host maintenance.

## Notes

- Docker Hub repositories must allow the Jenkins credentials to push and the server to pull.
- The frontend image tag and backend image tag are set from the Jenkins build's Git commit; deployment uses that same tag.
- Use a strong unique `JWT_SECRET`; replacing it invalidates existing login tokens.
- This project stores application records in a JSON file. It is suitable for a small demo deployment; concurrent writes and multi-replica scaling need a database-backed API.
