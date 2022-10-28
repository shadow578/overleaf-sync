# Overleaf CE sync action

one-way sync overleaf ce projects to github

```yaml
- uses: shadow578/overleaf-sync@0.1.0
  with:
    # store credentials as action secret
    host: ${{ secrets.OL_HOST }}
    email: ${{ secrets.OL_EMAIL }}
    password: ${{ secrets.OL_PASSWORD }}
    
    # download to ./projects, create one subdirectory per project 
    downloads_path: './projects'

    # automatically accept invites to new projects
    accept_invites: true

    # force re-download on every run
    force_download: true

    # only download select projects, one per line
    # both project id and display name can be used
    projects: |
      'Test Project'
      635ac4e011188d00842f0ebf
```