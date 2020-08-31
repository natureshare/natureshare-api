echo $WORKFLOW_TOKEN

curl -H "Accept: application/vnd.github.everest-preview+json" \
     -H "Authorization: token $WORKFLOW_TOKEN" \
     --request POST \
     --data '{"event_type": "api-actions"}' \
     https://api.github.com/repos/natureshare/natureshare-files/dispatches

