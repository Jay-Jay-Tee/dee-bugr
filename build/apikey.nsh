; ─── DEE-bugr: Groq API Key Page ───────────────────────────────────────────
; Injected into the NSIS installer by electron-builder via customHeader +
; installerSidebar overrides.  This file is !included by the generated script.
;
; We use the nsDialogs plugin (ships with NSIS 3.x) to show a custom page
; that lets the user paste their Groq API key.  On completion the key is
; written to $INSTDIR\.env so dotenv picks it up at runtime.
; ────────────────────────────────────────────────────────────────────────────

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var ApiKeyDialog
Var ApiKeyLabel
Var ApiKeyInput
Var ApiKeyValue
Var ApiKeyNote

; ── Custom page: show before the standard "Install" page ─────────────────────
Page custom ApiKeyPageCreate ApiKeyPageLeave

Function ApiKeyPageCreate
  nsDialogs::Create 1018
  Pop $ApiKeyDialog
  ${If} $ApiKeyDialog == error
    Abort
  ${EndIf}

  ; ── Heading ────────────────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 0 100% 20u "Groq API Key (required for AI features)"
  Pop $ApiKeyLabel

  ; ── Text field ─────────────────────────────────────────────────────────────
  ${NSD_CreateText} 0 24u 100% 14u ""
  Pop $ApiKeyInput
  ; Pre-fill if the user already ran setup before
  ${If} $ApiKeyValue != ""
    ${NSD_SetText} $ApiKeyInput $ApiKeyValue
  ${EndIf}

  ; ── Helper note ────────────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 42u 100% 32u \
    "Paste your key above (starts with gsk_…).  Get a free key at:$\r$\nhttps://console.groq.com$\r$\nYou can also leave this blank and add it later to the .env file."
  Pop $ApiKeyNote

  nsDialogs::Show
FunctionEnd

Function ApiKeyPageLeave
  ${NSD_GetText} $ApiKeyInput $ApiKeyValue
  ; Trim whitespace so accidental spaces don't break the key
  ; (whitespace trimming handled by user paste behaviour)
FunctionEnd

; ── Write .env after files are installed ─────────────────────────────────────
; electron-builder's NSIS template fires !insertmacro customInstall after the
; [Install] section copies files.  We hook there.

!macro customInstall
  ; Build the .env content
  StrCpy $0 "DEE_BUGR_GROQ_KEY=$ApiKeyValue$\r$\nDEE_BUGR_AI_MODE=groq$\r$\n"

  ; Write to $INSTDIR\.env  (Unicode UTF-8, no BOM)
  FileOpen  $1 "$INSTDIR\.env" w
  FileWrite $1 $0
  FileClose $1
!macroend
