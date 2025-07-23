import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { App } from './app'; // Corrected import path and class name
import { LlmOutputDisplayComponent } from './components/llm-output-display/llm-output-display.component';
// LlmOutputService and NgZone are not directly injected into App, but are deps of LlmOutputDisplayComponent which is mocked.

// Mock LlmOutputDisplayComponent to simplify AppComponent tests
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-llm-output-display',
  template: '<p>Mock LLM Output Display</p>',
  standalone: true,
})
class MockLlmOutputDisplayComponent {
  @Input() llmOutput: string = '';
  @Input() isStreamFinished: boolean = false;
  @Input() blocks: any[] = [];
  @Input() fallbackBlock: any = null;
}

describe('AppComponent', () => {
  let component: App; // Corrected type
  let fixture: ComponentFixture<App>; // Corrected type

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App], // AppComponent (App) is standalone and imports its dependencies
    })
    .overrideComponent(App, { // Override for AppComponent (App)
        remove: {imports: [LlmOutputDisplayComponent]},
        add: {imports: [MockLlmOutputDisplayComponent]}
    })
    .compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    fixture.detectChanges(); 
  });

  afterEach(() => {
    // Ensure any timers set by the component are cleared
    if (component['streamInterval']) {
      clearInterval(component['streamInterval']);
    }
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it(`should have as title 'llm-ui'`, () => {
    expect(component.title).toEqual('llm-ui'); 
  });

  it('should render the mock LlmOutputDisplayComponent', () => {
    const displayElement = fixture.debugElement.query(By.directive(MockLlmOutputDisplayComponent));
    expect(displayElement).toBeTruthy();
  });

  it('should pass initial llmOutput and isStreamFinished to LlmOutputDisplayComponent', () => {
    // Initial state for testLlmOutput is "" and testIsStreamFinished is false before first tick
    fixture.detectChanges(); // Ensure initial values are set if constructor logic is complex before first interval

    const displayComponentInstance = fixture.debugElement
      .query(By.directive(MockLlmOutputDisplayComponent))
      .componentInstance as MockLlmOutputDisplayComponent;

    expect(displayComponentInstance.llmOutput).toEqual(component.testLlmOutput); // Should be "" initially
    expect(displayComponentInstance.isStreamFinished).toEqual(component.testIsStreamFinished); // Should be false initially
  });

  it('should update testLlmOutput and testIsStreamFinished over time (testing first step of simulation)', fakeAsync(() => {
    // Initial values set by constructor and startStream
    expect(component.testLlmOutput).toBe('');
    expect(component.testIsStreamFinished).toBe(false);
    
    tick(component.intervalMs); // Let one interval pass
    fixture.detectChanges();

    const expectedFirstChunk = component.fullText.slice(0, component.chunkSize);
    expect(component.testLlmOutput).toBe(expectedFirstChunk);
    expect(component.testIsStreamFinished).toBe(false);

    // Clean up remaining timers
    // Tick enough to ensure the full text would have been processed
    tick(component.fullText.length / component.chunkSize * component.intervalMs + component.intervalMs); 
    discardPeriodicTasks(); 
  }));
  
  it('should stream the full text and set isStreamFinished to true', fakeAsync(() => {
    const totalStreamTime = Math.ceil(component.fullText.length / component.chunkSize) * component.intervalMs;
    
    tick(totalStreamTime); // Let the entire stream complete
    fixture.detectChanges();

    expect(component.testLlmOutput).toBe(component.fullText);
    expect(component.testIsStreamFinished).toBe(true);
    
    discardPeriodicTasks(); // Ensure all periodic timers are cleared
  }));


  it('should render title in the template if app.html has it', () => {
    // The app.html was updated to:
    // <h1>Welcome to {{ title }}!</h1>
    // <app-llm-output-display ...></app-llm-output-display>
    // <router-outlet />
    const compiled = fixture.nativeElement as HTMLElement;
    const h1 = compiled.querySelector('h1');
    expect(h1).toBeTruthy();
    if(h1) { // type guard
        expect(h1.textContent).toContain('Welcome to llm-ui!');
    }
  });
});
