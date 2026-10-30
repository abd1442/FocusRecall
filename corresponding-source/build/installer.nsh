; Applied before the generated assisted-installer license page is declared.
; Keep the standard install-scope, directory, shortcut and uninstall behavior.
!include "installer-locales.nsh"
!define MUI_LICENSEPAGE_BUTTON "$(^NextBtn)"
!define MUI_LICENSEPAGE_TEXT_TOP "$(FocusRecallLicenseTop)"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "GPL-3.0-only"
!define MUI_LICENSEPAGE_TITLE "$(FocusRecallLicenseTop)"
!define MUI_LICENSEPAGE_SUBTITLE "GPL-3.0-only"

; Never terminate a study process during installation or uninstall. This also
; protects upgrades whose old executable has a different product name.
!macro customCheckAppRunning
  Push $R8
  Push $R0
  ${Do}
    StrCpy $R8 ""
    !insertmacro FocusRecallFindRunning "A14Pomodoro.exe"
    !insertmacro FocusRecallFindRunning "FocusRecall.exe"
    !insertmacro FocusRecallFindRunning "Learnalyt.exe"
    !insertmacro FocusRecallFindRunning "trifocus.exe"
    ${If} $R8 == ""
      ${ExitDo}
    ${EndIf}
    ${If} ${Silent}
      SetErrorLevel 2
      Quit
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Close A14 Pomodoro or a previous version, including its tray icon, then choose Retry. Your open study session will not be terminated by Setup." IDRETRY +2
    Quit
  ${Loop}
  Pop $R0
  Pop $R8
!macroend

!macro FocusRecallFindRunning EXECUTABLE
  nsProcess::_FindProcess "${EXECUTABLE}"
  Pop $R0
  ${If} $R0 == 0
    StrCpy $R8 "running"
  ${ElseIf} $R0 != 603
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Setup could not verify whether the study application is closed. No installation changes were made. Close the app and try again."
    ${EndIf}
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
!include LogicLib.nsh
!include nsDialogs.nsh
Var focusrecallDesktopChoice
Var focusrecallDesktopCheckbox

; Extend the standard command-line flag rather than replacing shortcut creation.
; Silent deployments retain the original flag/default behavior.
!macro _focusrecallNoDesktopShortcut _a _b _t _f
  ${StdUtils.TestParameter} $R9 "no-desktop-shortcut"
  ${If} $focusrecallDesktopChoice == "0"
    StrCpy $R9 "true"
  ${EndIf}
  StrCmp "$R9" "true" `${_t}` `${_f}`
!macroend
!define /redef isNoDesktopShortcut `"" focusrecallNoDesktopShortcut ""`

!macro customPageAfterChangeDir
  ; The stock page appends the NEW product name even to an existing install's
  ; registered location. Preserve a recognised upgrade destination verbatim.
  !define /redef MUI_PAGE_CUSTOMFUNCTION_PRE FocusRecallInstFilesPre
  Function FocusRecallInstFilesPre
    Push $R8
    ReadRegStr $R8 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $R8 != ""
    ${AndIf} $INSTDIR == $R8
      Pop $R8
      Return
    ${EndIf}
    ReadRegStr $R8 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $R8 != ""
    ${AndIf} $INSTDIR == $R8
      Pop $R8
      Return
    ${EndIf}
    Pop $R8
    Call instFilesPre
  FunctionEnd
  Page custom FocusRecallShortcutPage FocusRecallShortcutLeave
  Function FocusRecallShortcutPage
    !insertmacro MUI_HEADER_TEXT "$(FocusRecallShortcutTitle)" "$(FocusRecallShortcutSubtitle)"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 10u 100% 18u "$(FocusRecallDesktopShortcut)"
    Pop $focusrecallDesktopCheckbox
    ${If} $focusrecallDesktopChoice == ""
      ${NSD_Check} $focusrecallDesktopCheckbox
    ${ElseIf} $focusrecallDesktopChoice == "1"
      ${NSD_Check} $focusrecallDesktopCheckbox
    ${EndIf}
    ${NSD_CreateLabel} 0 40u 100% 35u "$(FocusRecallShortcutHint)"
    Pop $0
    nsDialogs::Show
  FunctionEnd
  Function FocusRecallShortcutLeave
    ${NSD_GetState} $focusrecallDesktopCheckbox $focusrecallDesktopChoice
  FunctionEnd
!macroend
!endif
