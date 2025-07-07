#!/bin/bash

# Install Pandoc
apt-get update && apt-get install -y pandoc

# Run your regular build command
pnpm run build
