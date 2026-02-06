# Driver Performance Scoring Methodology
TruckMates Platform Performance Scoring System

## Overview

TruckMates uses a comprehensive scoring system to evaluate driver performance across multiple dimensions. The scoring system helps fleet managers identify top performers, recognize areas for improvement, and make data-driven decisions about driver assignments and training.

---

## Overall Driver Behavior Score (0-100)

The overall driver behavior score is a composite metric that combines three main components:

### Score Components

1. **Violation Score** (0-50 points)
2. **Compliance Score** (0-30 points)
3. **Safety Score** (0-20 points)

**Total Maximum Score**: 100 points

---

## 1. Violation Score (0-50 points)

### Calculation Method

The violation score is based on the number of HOS violations per 100 driving hours.

**Formula**: 
```
violationsPer100Hours = (totalViolations / totalDrivingHours) × 100
```

### Scoring Scale

| Violations per 100 Hours | Score |
|------------------------|-------|
| 0 violations | 50 points |
| 0.1 - 1.0 violations | 45-49 points |
| 1.1 - 2.0 violations | 40-44 points |
| 2.1 - 3.0 violations | 35-39 points |
| 3.1 - 5.0 violations | 25-34 points |
| 5.1 - 10.0 violations | 15-24 points |
| 10.1+ violations | 0-14 points |

### Violation Types Tracked

- **HOS Violations**: Driving time, on-duty time, break requirements
- **Speeding Events**: Exceeding speed limits
- **Hard Braking**: Aggressive driving behavior
- **Other Safety Events**: As defined by ELD system

---

## 2. Compliance Score (0-30 points)

### Calculation Method

The compliance score evaluates driver adherence to company policies and regulatory requirements.

### Scoring Components

| Component | Weight | Max Points |
|-----------|--------|------------|
| Documentation Completeness | 40% | 12 points |
| On-Time Delivery Rate | 30% | 9 points |
| Inspection Compliance | 20% | 6 points |
| Training Completion | 10% | 3 points |

### Documentation Completeness (0-12 points)

- **License Status**: Valid, not expired (3 points)
- **Certifications**: Up-to-date certifications (3 points)
- **Medical Card**: Valid medical card (2 points)
- **Insurance**: Proper insurance documentation (2 points)
- **Other Documents**: All required documents present (2 points)

### On-Time Delivery Rate (0-9 points)

**Formula**: `(On-time deliveries / Total deliveries) × 9`

- **95%+ on-time**: 9 points
- **90-94% on-time**: 7-8 points
- **85-89% on-time**: 5-6 points
- **80-84% on-time**: 3-4 points
- **<80% on-time**: 0-2 points

### Inspection Compliance (0-6 points)

- **No failed inspections**: 6 points
- **1 failed inspection**: 4 points
- **2 failed inspections**: 2 points
- **3+ failed inspections**: 0 points

### Training Completion (0-3 points)

- **All required training completed**: 3 points
- **80-99% completed**: 2 points
- **60-79% completed**: 1 point
- **<60% completed**: 0 points

---

## 3. Safety Score (0-20 points)

### Calculation Method

The safety score evaluates driver safety performance and incident history.

### Scoring Components

| Component | Weight | Max Points |
|-----------|--------|------------|
| Accident History | 50% | 10 points |
| Safety Events | 30% | 6 points |
| Customer Feedback | 20% | 4 points |

### Accident History (0-10 points)

- **No accidents (last 12 months)**: 10 points
- **1 minor accident**: 7 points
- **2 minor accidents**: 4 points
- **1 major accident**: 2 points
- **2+ major accidents**: 0 points

### Safety Events (0-6 points)

Based on ELD safety events (hard braking, rapid acceleration, etc.):

- **0-1 events per 1000 miles**: 6 points
- **2-3 events per 1000 miles**: 4 points
- **4-5 events per 1000 miles**: 2 points
- **6+ events per 1000 miles**: 0 points

### Customer Feedback (0-4 points)

Based on customer ratings and feedback:

- **Average rating 4.5+**: 4 points
- **Average rating 4.0-4.4**: 3 points
- **Average rating 3.5-3.9**: 2 points
- **Average rating 3.0-3.4**: 1 point
- **Average rating <3.0**: 0 points

---

## Performance Grades

Based on the overall score, drivers are assigned performance grades:

| Score Range | Grade | Description |
|-------------|-------|-------------|
| 90-100 | Excellent | Top performer, minimal issues |
| 75-89 | Good | Solid performance, minor improvements needed |
| 60-74 | Fair | Meets basic requirements, needs improvement |
| 45-59 | Needs Improvement | Below expectations, requires attention |
| 0-44 | Poor | Significant issues, intervention required |

---

## Score Calculation Frequency

- **Real-Time**: Violation score updates immediately when violations occur
- **Daily**: Overall score recalculated daily at midnight (UTC)
- **Historical**: Scores stored for trend analysis and reporting

---

## Score Factors

### Time Period

Scores are calculated based on a rolling time period:
- **Default**: Last 30 days
- **Customizable**: Can be set to 7, 14, 30, 60, or 90 days
- **Historical**: Available for any date range

### Data Sources

- **ELD Logs**: HOS data, violations, safety events
- **Load Records**: Delivery times, on-time performance
- **Documentation**: License, certifications, medical cards
- **Customer Feedback**: Ratings and comments
- **Accident Reports**: Incident history

---

## Score Breakdown Example

### Example Driver: John Doe

**Overall Score**: 87/100 (Good)

**Breakdown**:
- **Violation Score**: 45/50 (0.5 violations per 100 hours)
- **Compliance Score**: 26/30 (95% on-time, complete docs)
- **Safety Score**: 16/20 (no accidents, low safety events)

**Grade**: Good

**Recommendations**:
- Continue current performance
- Minor improvement: Reduce violations further for "Excellent" grade

---

## Use Cases

### Driver Assignment
- Assign high-value loads to drivers with "Excellent" or "Good" scores
- Use scores to match driver capabilities with load requirements

### Training & Development
- Identify drivers in "Needs Improvement" or "Poor" categories
- Target training programs based on score breakdown
- Track improvement over time

### Performance Reviews
- Use scores as objective metrics in performance reviews
- Set goals based on score components
- Recognize top performers

### Risk Management
- Monitor drivers with declining scores
- Proactively address issues before they become problems
- Reduce insurance costs through improved safety scores

---

## Score Transparency

- **Driver Access**: Drivers can view their own scores and breakdowns
- **Manager Access**: Managers can view all driver scores
- **Historical Trends**: Track score changes over time
- **Export**: Export scores for reporting and analysis

---

## Related Documentation

- [KPI Definitions](./kpi-definitions.md)
- [ELD HOS Logic](./eld-hos-logic.md)
- [ELD Violations](./eld-violations.md)
- [Driver Management](../features/driver-management.md)




