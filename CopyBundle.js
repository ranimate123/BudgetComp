import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import PROJECT_COST_FIELD from '@salesforce/schema/Project__c.Project_Cost__c';
import { CloseActionScreenEvent } from 'lightning/actions';
import saveEditBudget from '@salesforce/apex/BudgetEditController.saveBudgetEdit';
import getDefaultBudget from '@salesforce/apex/BudgetEditController.getDefaultBudget';
import getBudgetForEdit from '@salesforce/apex/BudgetEditController.getBudgetForEdit';


export default class MarketingBudgetModal extends LightningElement {
    //@api recordId;

    @track projectCost = 0;
    @track marketingPercent = 0;
    @track marketingAmount = 0;
    @track cpPercent = 0;
    @track cpAmount = 0;
    @track otherPercent = 0;
    @track otherAmount = 0;
    @track numberOfYears = 1;
    @track yearTables = [];
    @track isEditMode = false;
    @track hasInitializedYears = false;

    _recordId;

@api
get recordId() {
    return this._recordId;
}
set recordId(value) {
    this._recordId = value;
    console.log('recordId set to:', value);
    this.connected();
}
    connected() {
    if (this.recordId?.startsWith('a1j')) {
        console.log('Entering edit mode for recordId:', this.recordId);
        this.isEditMode = true;
        this.loadExistingBudget();
        return;
    }

    getDefaultBudget()
        .then(r => {
            this.marketingPercent = r.Marketing_Expense_Budget_Percentage__c || 0;
            this.cpPercent = r.CP_Expense_Budget_Percantage__c || 0;
            this.otherPercent = r.Other_Expense_Marketing_Budget_Percentag__c || 0;

            this.hasInitializedYears = false;
            this.generateYearTables();
            this.hasInitializedYears = true;
        })
        .catch(console.error);
}


    @wire(getRecord, { recordId: '$recordId', fields: [PROJECT_COST_FIELD] })
    wiredProject({ data }) {
        if (data) {
            this.projectCost = getFieldValue(data, PROJECT_COST_FIELD) || 0;
            this.calculateAmounts();
        }
    }

    calculateAmounts() {
    this.marketingAmount = +(this.projectCost * this.marketingPercent / 100).toFixed(2);
    this.cpAmount = +(this.marketingAmount * this.cpPercent / 100).toFixed(2);
    this.otherAmount = +(this.marketingAmount * this.otherPercent / 100).toFixed(2);

    if (this.yearTables?.length) {
        this.yearTables = this.yearTables.map(y => {
            const total = y.totalBudget;
            return {
                ...y,
                percent: this.plannedBudget ? +(total / this.plannedBudget * 100).toFixed(2) : 0
            };
        });
    }

    if (!this.hasInitializedYears) {
        this.generateYearTables();
        this.hasInitializedYears = true;
    }
}



    get plannedBudget() {
        return +(this.marketingAmount - this.cpAmount - this.otherAmount).toFixed(2);
    }

    get usedBudget() {
        return this.yearTables.reduce((s, y) => s + (y.totalBudget || 0), 0);
    }

    get remainingBudget() {
        return Math.max(this.plannedBudget - this.usedBudget, 0);
    }

   handleChange(e) {
    const g = e.target.dataset.group;
    const t = e.target.dataset.type;
    const v = Number(e.target.value) || 0;

    if (g === 'marketing') {
        if (t === 'percent') {
            this.marketingPercent = v;
            this.calculateAmounts();
        } else {
            this.marketingAmount = v;
            this.marketingPercent = this.projectCost ? +(v / this.projectCost * 100).toFixed(2) : 0;
        }
    }

    if (g === 'cp') {
        if (t === 'percent') {
            this.cpPercent = v;
            this.calculateAmounts();
        } else {
            this.cpAmount = v;
            this.cpPercent = this.marketingAmount ? +(v / this.marketingAmount * 100).toFixed(2) : 0;
        }
    }

    if (g === 'other') {
        if (t === 'percent') {
            this.otherPercent = v;
            this.calculateAmounts();
        } else {
            this.otherAmount = v;
            this.otherPercent = this.marketingAmount ? +(v / this.marketingAmount * 100).toFixed(2) : 0;
        }
    }
}


   handleYearsChange(e) {
    this.numberOfYears = Number(e.target.value) || 1;

    this.hasInitializedYears = false;
    this.generateYearTables();
    this.hasInitializedYears = true;
}


    generateYearTables() {
        this.yearTables = Array.from({ length: this.numberOfYears }, (_, i) => ({
            year: i + 1,
            percent: 0,
            totalBudget: 0,
            leadTarget: 0,
            quarters: [
                { label: `Y${i + 1}Q1`, amount: 0 },
                { label: `Y${i + 1}Q2`, amount: 0 },
                { label: `Y${i + 1}Q3`, amount: 0 },
                { label: `Y${i + 1}Q4`, amount: 0 }
            ]
        }));
    }

    handleYearTotalChange(e) {
        const y = +e.target.dataset.year;
        const v = +e.target.value || 0;
        this.yearTables = this.yearTables.map(r =>
            r.year === y
                ? {
                    ...r,
                    totalBudget: v,
                    percent: this.plannedBudget
                        ? +(v / this.plannedBudget * 100).toFixed(2)
                        : 0,
                    quarters: r.quarters.map(q => ({ ...q, amount: +(v / 4).toFixed(2) }))
                }
                : r
        );
    }

    handleQuarterChange(e) {
        const y = +e.target.dataset.year;
        const q = e.target.dataset.quarter;
        const v = +e.target.value || 0;

        this.yearTables = this.yearTables.map(r =>
            r.year === y
                ? {
                    ...r,
                    quarters: r.quarters.map(x =>
                        x.label === q ? { ...x, amount: v } : x
                    )
                }
                : r
        );
    }

    handleLeadTargetChange(e) {
        const y = +e.target.dataset.year;
        const v = +e.target.value || 0;
        this.yearTables = this.yearTables.map(r =>
            r.year === y ? { ...r, leadTarget: v } : r
        );
    }
    handleYearPercentChange(e) {
    const year = +e.target.dataset.year;
    const newPercent = +e.target.value || 0;

    this.yearTables = this.yearTables.map(y => {
        if (y.year === year) {
            const total = +(this.plannedBudget * newPercent / 100).toFixed(2);
            const perQuarter = +(total / 4).toFixed(2); // distribute across quarters

            return {
                ...y,
                percent: newPercent,
                totalBudget: total,
                quarters: y.quarters.map(q => ({ ...q, amount: perQuarter }))
            };
        }
        return y;
    });
}


    loadExistingBudget() {
        getBudgetForEdit({ budgetId: this.recordId })
            .then(r => {
                const b = r.budget;
                this.marketingPercent = b.Marketing_Expense_Budget_Percentage__c;
                this.marketingAmount = b.Marketing_Expense_Planned_Budget__c;
                this.cpPercent = b.CP_Expense_Budget_Percantage__c;
                this.cpAmount = b.CP_Expense_Planned_Budget__c;
                this.otherPercent = b.Other_Expense_Marketing_Budget_Percentag__c;
                this.otherAmount = b.Other_Expense_Marketing_Planned_Budget__c;
                console.log('Loaded budget:', b);


                this.numberOfYears = r.yearly.length;
                this.yearTables = r.yearly.map((y, i) => ({
                    year: i + 1,
                    percent: y.Plannned_Budget_for_Online_Offline__c,
                    totalBudget: y.Plannned_Budget_for_Online_Offline_value__c,
                    leadTarget: y.Lead_Gen_Target__c,
                    quarters: [
                        { label: `Y${i + 1}Q1`, amount: y.Quater1__c },
                        { label: `Y${i + 1}Q2`, amount: y.Quater2__c },
                        { label: `Y${i + 1}Q3`, amount: y.Quater3__c },
                        { label: `Y${i + 1}Q4`, amount: y.Quater4__c }
                    ]
                }));
                            this.hasInitializedYears = true;

            });

    }

   saveBudgetRecord() {
    const planned = this.plannedBudget;

    // Check if sum of year totals equals plannedBudget
    const totalYearAmount = this.yearTables.reduce((sum, y) => sum + (y.totalBudget || 0), 0);
    if (parseFloat(totalYearAmount.toFixed(2)) !== parseFloat(planned.toFixed(2))) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Validation Error',
                message: `Sum of all year totals (${totalYearAmount.toFixed(
                    2
                )}) must exactly equal the Planned Budget (${planned.toFixed(2)}).`,
                variant: 'error',
                mode: 'dismissable'
            })
        );
        return;
    }

    for (let y of this.yearTables) {
        const quarterSum = y.quarters.reduce((sum, q) => sum + (q.amount || 0), 0);
        if (parseFloat(quarterSum.toFixed(2)) !== parseFloat((y.totalBudget || 0).toFixed(2))) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: `Sum of quarters for Year ${y.year} (${quarterSum.toFixed(
                        2
                    )}) must equal that year's planned budget (${y.totalBudget.toFixed(2)}).`,
                    variant: 'error',
                    mode: 'dismissable'
                })
            );
            return;
        }
    }

    saveEditBudget({
        budgetId: this.recordId,
        marketingPercent: this.marketingPercent,
        marketingAmount: this.marketingAmount,
        cpPercent: this.cpPercent,
        cpAmount: this.cpAmount,
        otherPercent: this.otherPercent,
        otherAmount: this.otherAmount,
        yearDistributions: JSON.stringify(this.yearTables)
    })
    .then(() => {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'New Budget version created',
                variant: 'success'
            })
        );
        this.dispatchEvent(new CloseActionScreenEvent());
    })
    .catch(e => {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: e.body?.message || e.message,
                variant: 'error'
            })
        );
    });
}



    close() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }
}
