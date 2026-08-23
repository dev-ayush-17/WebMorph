# CodeRabbit Code Review Integration Guide

To maintain code quality and ensure continuous automated feedback during development, **CodeRabbit AI** has been integrated into the repository workflow. 

This guide outlines how to enable it on your repository.

---

## What CodeRabbit Does
- **Automated Pull Request Reviews**: Reviews every commit, highlighting logic bugs, security issues, performance hotspots, and code formatting deviations.
- **Interactive Chat**: Allows developers to ask questions directly in PR comments (e.g., *"How can I optimize this retry logic?"*).
- **Line-by-line Diff Suggestions**: Proposes code refactors as direct drop-in Git suggestions.

---

## Setup Instructions

### 1. Install CodeRabbit App
1. Navigate to the GitHub Marketplace or direct link: [github.com/apps/coderabbitai](https://github.com/apps/coderabbitai).
2. Click **Install** or **Configure**.
3. Choose your personal account or organization.
4. Select **Only select repositories** and pick `WebMorph` (or your cloned repository name).
5. Click **Install & Authorize**.

### 2. Configuration (Optional)
CodeRabbit works automatically out of the box with zero configuration. If you want to customize its behavior (e.g., change review language, toggle options), you can create a `.coderabbit.yaml` file in the root of your repository:

```yaml
# .coderabbit.yaml configuration example
language: "en-US"
reviews:
  profile: "chill"
  request_reviews_from_humans: true
```
This is configured at your discretion and should be added after the initial review.
