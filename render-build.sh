#!/usr/bin/env bash
# Exit on error
set -e

# Install Vite globally
npm install -g vite

# Install Chrome for puppeteer-core
apt-get update
apt-get install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
apt-get update
apt-get install -y google-chrome-stable

# Print Chrome version for debugging
google-chrome --version

# Continue with normal build
npm install
npm install --prefix Student_summary
cd Student_summary
vite build
cd .. 