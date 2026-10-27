// QA only: a bounded, fictional foreground window. Never packaged with the app.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
static LRESULT CALLBACK Window(HWND w,UINT m,WPARAM a,LPARAM b){
 if(m==WM_TIMER){
  // QA-only foreground activation on this input desktop. Detach immediately;
  // this code is not included in the shipped sampler or application resources.
  const DWORD own=GetCurrentThreadId(),front=GetWindowThreadProcessId(GetForegroundWindow(),nullptr);
  const bool attached=front&&front!=own&&AttachThreadInput(own,front,TRUE);
  BringWindowToTop(w);SetForegroundWindow(w);SetFocus(w);
  if(attached)AttachThreadInput(own,front,FALSE);
  return 0;
 }
 if(m==WM_DESTROY){PostQuitMessage(0);return 0;}
 return DefWindowProcW(w,m,a,b);
}
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR,int){
 WNDCLASSW type={};type.lpfnWndProc=Window;type.hInstance=instance;type.lpszClassName=L"FocusRecallFictionalQA";
 if(!RegisterClassW(&type))return 1;
 HWND w=CreateWindowW(type.lpszClassName,L"Fictional QA PRIVATE document - no real data",WS_OVERLAPPEDWINDOW,100,100,500,160,nullptr,nullptr,instance,nullptr);
 if(!w)return 2;
 ShowWindow(w,SW_SHOW);SetTimer(w,1,500,nullptr);SetTimer(w,2,300000,nullptr);
 MSG message;while(GetMessageW(&message,nullptr,0,0)>0){if(message.message==WM_TIMER&&message.wParam==2)break;TranslateMessage(&message);DispatchMessageW(&message);}
 DestroyWindow(w);return 0;
}
