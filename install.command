#!/bin/sh
# Double-click to install or update Coralline (macOS).
curl -LsSf https://raw.githubusercontent.com/onetrickpony1/coralline/main/install.sh | sh
echo
printf "Press Return to close."
read -r _ || true
