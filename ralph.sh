set -e

if [ -z "$1" ]; then
    echo "Usage: $1 <iterations>"
    exit 1
fi

for ((i=1; i<=$1; i++)); do
    echo "Iteration $i"
    echo "----------------------------------"
    result=$(claude --permission-mode bypassPermissions -p "@plan.json @progress.md \
    1. find the highest priority feature that is not yet passing. this should be the one YOU decide has highest priority and not necessarily the first one. \
    2. before everything and after deciding the highest priority feature to implement, WRITE tests for the feature, follow TDD. \
    3. check the types and linting errors using biome and make sure they all pass. \
    4. update the plan.json once the feature is implemented and passed all tests and checks. \
    5. append your progress to the progress.md file following a simple bullet point format and don't be too verbose. this is useful for the next person to continue the work. \
    6. make a git commit of that feature then push to the remote repository. \
    7. ONLY WORK ON ONE SIGNLE FEATURE. \
    8. remember to always check tests, linting, and types all pass before committing. \
    9. if while working , you notice the plan.json is complete. output <promise>COMPLETE</promise>. \
    ")

    echo "$result"

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
        echo "Plan.json is complete. Exiting."
        exit 0
    fi
done