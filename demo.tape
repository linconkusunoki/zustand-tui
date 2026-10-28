Output demo.mp4
Output demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 1200
Set Height 720
Set Padding 10
Set Theme "Catppuccin Mocha"

Type "./run-demo.sh"
Enter

# Let TUI boot and initial stores register
Sleep 3.5s

# Allow actions to stream in
Sleep 3s

# Navigate down to booking-store
Down
Sleep 1.5s

# Switch to Actions pane
Tab
Sleep 1.5s

# Navigate actions timeline
Down
Sleep 1.5s

# Toggle Diff mode to show colored property changes!
Type "d"
Sleep 2.5s

Down
Sleep 1.5s

Down
Sleep 2s

# Toggle back to Snapshot view
Type "d"
Sleep 2s

# Switch focus to State viewer pane
Tab
Sleep 1.5s

# Scroll down JSON state
Down
Sleep 500ms
Down
Sleep 500ms
Down
Sleep 1.5s

# Switch back to Stores pane
Tab
Sleep 1.5s

# Cleanly exit
Type "q"
Sleep 1s
