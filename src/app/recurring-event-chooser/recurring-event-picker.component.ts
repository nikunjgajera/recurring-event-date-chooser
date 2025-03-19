import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NgbCalendar, NgbDate, NgbDateParserFormatter} from '@ng-bootstrap/ng-bootstrap';
import {Frequency, Options, RRule} from 'rrule';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

export function toNativeDate(ngbDate: NgbDate): Date {
  return new Date(Date.UTC(ngbDate.year, ngbDate.month - 1, ngbDate.day));
}

@Component({
  selector: 'app-recurring-event-chooser',
  templateUrl: './recurring-event-picker.component.html',
  styleUrls: ['./recurring-event-picker.component.scss']
})
export class RecurringEventPickerComponent implements OnInit, OnDestroy {
  Frequency = Frequency;
  recurringForm: FormGroup;
  hoveredDate: NgbDate | null = null;
  dates: Date[] = [];
  rule = '';

  private today: NgbDate;
  private weekdayMap = [
    RRule.MO,
    RRule.TU,
    RRule.WE,
    RRule.TH,
    RRule.FR,
    RRule.SA,
    RRule.SU
  ];

  private monthsMap = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  private weekdaysMap = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  private monthlyFreqMap: any = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last'];
  private weekdayMonthFreqMap = this.monthlyFreqMap.flatMap(d => this.weekdaysMap.map(v => d + ' ' + v));

  private destroy$ = new Subject();

  get f(): any {
    return this.recurringForm.controls;
  }

  constructor(
    private fb: FormBuilder,
    private calendar: NgbCalendar,
    public formatter: NgbDateParserFormatter
  ) { }

  ngOnInit(): void {
    this.today = this.calendar.getToday();
    this.initRecurringForm();
    this.subscribeToFormValue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDateSelection(date: NgbDate): void {
    if (!this.f.startDate.value && !this.f.endDate.value) {
      this.f.startDate.setValue(date);
    } else if (this.f.startDate.value && !this.f.endDate.value && date && date.after(this.f.startDate.value)) {
      this.f.endDate.setValue(date);
    } else {
      this.f.endDate.setValue(null);
      this.f.startDate.setValue(date);
    }
  }

  isHovered(date: NgbDate): boolean {
    return this.f.startDate.value &&
      !this.f.endDate.value &&
      this.hoveredDate &&
      date.after(this.f.startDate.value) &&
      date.before(this.hoveredDate);
  }

  isInside(date: NgbDate): boolean {
    return this.f.endDate.value && date.after(this.f.startDate.value) && date.before(this.f.endDate.value);
  }

  isRange(date: NgbDate): boolean {
    return date.equals(this.f.startDate.value) ||
      (this.f.endDate.value && date.equals(this.f.endDate.value)) ||
      this.isInside(date) || this.isHovered(date);
  }

  validateInput(currentValue: NgbDate | null, input: string): NgbDate | null {
    const parsed = this.formatter.parse(input);
    return parsed && this.calendar.isValid(NgbDate.from(parsed)) ? NgbDate.from(parsed) : currentValue;
  }

  setStartDate(value: string): void {
    this.f.startDate.setValue(this.validateInput(this.f.startDate.value, value));
  }

  setEndDate(value: string): void {
    this.f.endDate.setValue(this.validateInput(this.f.endDate.value, value));
  }

  private initRecurringForm(): void {
    this.recurringForm = this.fb.group({
      startDate: [this.today, Validators.required],
      endDate: [this.calendar.getNext(this.today, 'd', 7), Validators.required],
      frequency: [Frequency.DAILY],
      onWeekday: this.fb.array(
        [false, false, false, false, false, false, false].map(val => this.fb.control(val))
      ),
      onMonthday: [[]],
      onEvery: [1, Validators.required],
      actionBy: ['DATE', Validators.required],
      onNWeekday: null,
      onMonth: this.monthsMap[0]
    });
  }

  private subscribeToFormValue(): void {
    this.recurringForm.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      const options: Partial<Options> = {
        freq: value.frequency,
        interval: Number(value.onEvery),
        dtstart: toNativeDate(value.startDate || this.today),
        until: toNativeDate(value.endDate || this.today),
        // byweekday: value.frequency === Frequency.WEEKLY ?
        //   this.getWeekday(value.onWeekday) : null,
        byweekday: (value.frequency === Frequency.MONTHLY || value.frequency === Frequency.YEARLY) && value.actionBy === 'DAY' ?
          this.getWeekdaysInJson(value.onNWeekday) : null,
        bymonthday: (value.frequency === Frequency.MONTHLY || value.frequency === Frequency.YEARLY) && value.actionBy === 'DATE' ?
          this.getMonthday(value.onMonthday) : null,
        bymonth: value.frequency === Frequency.YEARLY ?
          this.monthsMap.indexOf(value.onMonth) + 1 : null
      };
      // console.log('options', options);
      const rule = new RRule(options);
      this.dates = rule.all();
      // Rule TMP is required because this library has a bug it is not able to transform to accurate string representation
      // that we required in order to save and parse it later
      const ruleTmp = value.actionBy === 'DAY' ? new RRule({...options, byweekday: this.getWeekdaysInArray(value.onNWeekday)}) : rule;
      // console.log(rule);
      this.rule = ruleTmp.toString();
      console.log('Applied Rule String --->' + rule.toString());
      console.log('RuleTmp String --->' + this.rule);
      // console.log('Rule From String -FREQ=MONTHLY;INTERVAL=1;BYDAY=+1MO,+5SA,-1SU,-1SA-->');
      // const rule2 = RRule.fromString(ruleTmp.toString());
      // console.log(rule2);
      // console.log(rule2.all());
    });
    const now = new Date();
    this.recurringForm.patchValue({
      startDate: this.calendar.getPrev(this.today, 'd', (now.getDate() - 1)),
      endDate: this.calendar.getNext(this.today, 'd', (new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - (now.getDate()))),
      frequency: Frequency.DAILY
    });
  }

  /**
   * This method is returns and array representation of [First Monday, Last Saturday] in json [{weekday:0, n: 1},{weekday: 5, n: -1}]
   * @param byWeekday - Array of selected weekdays combination
   */
  private getWeekdaysInJson(byWeekday: string[]): any {
    return !byWeekday ? [] : byWeekday
      .map(d => ( {weekday : this.weekdaysMap.indexOf(d.split(' ')[1]), n : this.getDayMonthFrequencyIndex(d.split(' ')[0])}));
  }

  /**
   * This method is returns and array representation of [First Monday, Last Saturday] in array [[0,1],[5,-1]]
   * @param byWeekday - Array of selected weekdays combination
   */
  private getWeekdaysInArray(byWeekday: string[]): any {
    return !byWeekday ? [] : byWeekday
      .map(d => ( [this.weekdaysMap.indexOf(d.split(' ')[1]), this.getDayMonthFrequencyIndex(d.split(' ')[0])]));
  }

  private getDayMonthFrequencyIndex(frequency): number{
    return frequency === 'Last' ? -1 : this.monthlyFreqMap.indexOf(frequency) + 1;
  }

  private getMonthday(byMonthday: any): any {
    return byMonthday;
  }
}
