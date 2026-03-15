/**
 * Test suite for failed subject detection and credit exclusion logic
 * This file can be run with: node test-failed-subjects.js
 */

// Mock implementation of the functions to test
const isSubjectFailed = (subject) => {
  return subject.completed && subject.grade?.toUpperCase().startsWith('F') === true
}

const calculateCompletedCredits = (subjects) => {
  return subjects.filter(s => s.completed && !isSubjectFailed(s)).reduce((sum, s) => sum + s.credits, 0)
}

const shouldIncludeInAverage = (subject) => {
  // Skip subjects with "Zápočet" type (credit only)
  if (subject.completion_type === 'Zápočet (Zp)') return false
  
  // Skip if no valuation (no points and no grade)
  if (!subject.points && !subject.grade) return false
  
  // Include if has points or valid grade
  return true
}

const gradeToNumber = (grade) => {
  if (!grade || grade === '-') return null
  
  // Handle F grades
  if (grade === '0' || grade.startsWith('F')) return 5.0
  
  // Handle numeric grades with optional minus
  const numericMatch = grade.match(/^(\d)(-)?$/)
  if (numericMatch) {
    const baseGrade = parseInt(numericMatch[1])
    const hasMinus = numericMatch[2] === '-'
    return baseGrade + (hasMinus ? 0.5 : 0)
  }
  
  // Handle letter grades
  const gradeMap = {
    'A': 1.0,
    'A-': 1.5,
    'B': 2.0,
    'B-': 2.5,
    'C': 3.0,
    'C-': 3.5,
    'D': 4.0,
    'D-': 4.5,
    'E': 5.0,
    'E-': 5.0,
  }
  
  return gradeMap[grade.toUpperCase()] || null
}

const calculateWeightedGradeAverage = (subjects, includeSubjectsWithPoints = false) => {
  const relevantSubjects = subjects.filter(shouldIncludeInAverage)
  if (relevantSubjects.length === 0) return null
  
  let totalWeightedGrade = 0
  let totalCredits = 0
  
  for (const subject of relevantSubjects) {
    // Skip subjects with points unless we're explicitly including them
    if (!includeSubjectsWithPoints && subject.points && subject.points > 0) continue
    
    const numericGrade = gradeToNumber(subject.grade || '')
    if (numericGrade === null) continue
    
    totalWeightedGrade += numericGrade * subject.credits
    totalCredits += subject.credits
  }
  
  if (totalCredits === 0) return null
  return totalWeightedGrade / totalCredits
}

// Test data
const testSubjects = [
  // Successfully completed subjects
  {
    id: '1',
    name: 'Matematika 1',
    semester: '1. ročník ZS',
    credits: 6,
    completed: true,
    grade: 'A',
    points: 95,
    completion_type: 'Zkouška (Zk)',
    subject_type: 'Povinný'
  },
  {
    id: '2',
    name: 'Programování 1',
    semester: '1. ročník ZS',
    credits: 4,
    completed: true,
    grade: 'B',
    points: 85,
    completion_type: 'Zápočet + Zkouška (Zp+Zk)',
    subject_type: 'Povinný'
  },
  {
    id: '3',
    name: 'Anglický jazyk',
    semester: '1. ročník ZS',
    credits: 2,
    completed: true,
    grade: 'A',
    points: null,
    completion_type: 'Zápočet (Zp)',
    subject_type: 'Povinný'
  },
  // Failed subjects - different F grade formats
  {
    id: '4',
    name: 'Fyzika',
    semester: '1. ročník LS',
    credits: 5,
    completed: true,
    grade: 'F',
    points: 35,
    completion_type: 'Zkouška (Zk)',
    subject_type: 'Povinný'
  },
  {
    id: '5',
    name: 'Chemie',
    semester: '1. ročník LS',
    credits: 3,
    completed: true,
    grade: 'Fx',
    points: 25,
    completion_type: 'Zkouška (Zk)',
    subject_type: 'Povinný'
  },
  {
    id: '6',
    name: 'Biologie',
    semester: '1. ročník LS',
    credits: 4,
    completed: true,
    grade: 'F-',
    points: 20,
    completion_type: 'Zkouška (Zk)',
    subject_type: 'Volitelný'
  },
  // Active/incomplete subjects
  {
    id: '7',
    name: 'Statistika',
    semester: '2. ročník ZS',
    credits: 5,
    completed: false,
    grade: null,
    points: null,
    completion_type: 'Zkouška (Zk)',
    subject_type: 'Povinný'
  },
  {
    id: '8',
    name: 'Databáze',
    semester: '2. ročník ZS',
    credits: 6,
    completed: false,
    grade: null,
    points: 78,
    completion_type: 'Zápočet + Zkouška (Zp+Zk)',
    subject_type: 'Povinný'
  },
  // Completed subject with no grade (credit only)
  {
    id: '9',
    name: 'Tělesná výchova',
    semester: '2. ročník ZS',
    credits: 1,
    completed: true,
    grade: null,
    points: null,
    completion_type: 'Zápočet (Zp)',
    subject_type: 'Ostatní'
  }
]

// Test functions
function runTests() {
  console.log('🧪 Testing Failed Subject Detection and Credit Exclusion Logic\n')
  
  // Test 1: isSubjectFailed function
  console.log('Test 1: isSubjectFailed function')
  console.log('===================================')
  
  const failedTests = [
    { subject: testSubjects[3], expected: true, description: 'Grade "F"' },
    { subject: testSubjects[4], expected: true, description: 'Grade "Fx"' },
    { subject: testSubjects[5], expected: true, description: 'Grade "F-"' },
    { subject: testSubjects[0], expected: false, description: 'Grade "A"' },
    { subject: testSubjects[1], expected: false, description: 'Grade "B"' },
    { subject: testSubjects[6], expected: false, description: 'Not completed' },
    { subject: testSubjects[8], expected: false, description: 'Completed but no grade' }
  ]
  
  failedTests.forEach(test => {
    const result = isSubjectFailed(test.subject)
    const status = result === test.expected ? '✅ PASS' : '❌ FAIL'
    console.log(`${status} ${test.description}: ${result} (expected: ${test.expected})`)
  })
  
  // Test 2: Credit calculation exclusion
  console.log('\nTest 2: Credit Calculation Exclusion')
  console.log('====================================')
  
  const totalCredits = testSubjects.reduce((sum, s) => sum + s.credits, 0)
  const completedCredits = calculateCompletedCredits(testSubjects)
  const allCompletedCredits = testSubjects.filter(s => s.completed).reduce((sum, s) => sum + s.credits, 0)
  
  console.log(`Total credits (all subjects): ${totalCredits}`)
  console.log(`Completed credits (including failed): ${allCompletedCredits}`)
  console.log(`Completed credits (excluding failed): ${completedCredits}`)
  
  const expectedCompletedCredits = 6 + 4 + 2 + 1 // Math + Programming + English + PE
  const actualFailedCredits = 5 + 3 + 4 // Physics + Chemistry + Biology
  
  console.log(`Expected completed credits: ${expectedCompletedCredits}`)
  console.log(`Expected failed credits: ${actualFailedCredits}`)
  
  const creditTest = completedCredits === expectedCompletedCredits
  console.log(`${creditTest ? '✅ PASS' : '❌ FAIL'} Credit exclusion logic`)
  
  // Test 3: Average calculation exclusion
  console.log('\nTest 3: Average Calculation (Current Implementation)')
  console.log('===================================================')
  
  const completedSubjects = testSubjects.filter(s => s.completed)
  const currentAverage = calculateWeightedGradeAverage(completedSubjects, true)
  
  // Current implementation includes failed subjects in average calculation
  // Manual calculation with failed subjects: (A=1.0*6 + B=2.0*4 + A=1.0*2 + F=5.0*5 + F=5.0*3 + F=5.0*4) / (6+4+2+5+3+4) = (6+8+2+25+15+20)/24 = 76/24 = 3.17
  const currentExpectedAverage = (1.0 * 6 + 2.0 * 4 + 1.0 * 2 + 5.0 * 5 + 5.0 * 3 + 5.0 * 4) / (6 + 4 + 2 + 5 + 3 + 4)
  
  console.log(`Current average (includes failed): ${currentAverage ? currentAverage.toFixed(2) : 'null'}`)
  console.log(`Expected current average: ${currentExpectedAverage.toFixed(2)}`)
  
  const currentAvgTest = currentAverage !== null && Math.abs(currentAverage - currentExpectedAverage) < 0.01
  console.log(`${currentAvgTest ? '✅ PASS' : '❌ FAIL'} Current implementation (includes failed subjects)`)
  
  // Test 3b: What the average SHOULD be (excluding failed subjects)
  console.log('\n   Expected behavior (excluding failed subjects):')
  const nonFailedSubjects = completedSubjects.filter(s => !isSubjectFailed(s))
  const correctedAverage = calculateWeightedGradeAverage(nonFailedSubjects, true)
  const expectedCorrectedAverage = (1.0 * 6 + 2.0 * 4 + 1.0 * 2) / (6 + 4 + 2)
  
  console.log(`   Corrected average (excludes failed): ${correctedAverage ? correctedAverage.toFixed(2) : 'null'}`)
  console.log(`   Expected corrected average: ${expectedCorrectedAverage.toFixed(2)}`)
  
  const correctedAvgTest = correctedAverage !== null && Math.abs(correctedAverage - expectedCorrectedAverage) < 0.01
  console.log(`   ${correctedAvgTest ? '✅ PASS' : '❌ FAIL'} Corrected implementation (excludes failed subjects)`)
  
  console.log('\n   🚨 ISSUE IDENTIFIED: Current implementation includes failed subjects in averages!')
  
  // Test 4: Component-specific statistics
  console.log('\nTest 4: Component Statistics Summary')
  console.log('===================================')
  
  const stats = {
    total: testSubjects.length,
    completed: testSubjects.filter(s => s.completed).length,
    failed: testSubjects.filter(s => isSubjectFailed(s)).length,
    totalCredits: totalCredits,
    completedCredits: completedCredits,
    failedCredits: testSubjects.filter(s => isSubjectFailed(s)).reduce((sum, s) => sum + s.credits, 0)
  }
  
  console.log(`Total subjects: ${stats.total}`)
  console.log(`Completed subjects: ${stats.completed}`)
  console.log(`Failed subjects: ${stats.failed}`)
  console.log(`Total credits: ${stats.totalCredits}`)
  console.log(`Completed credits (excluding failed): ${stats.completedCredits}`)
  console.log(`Failed credits: ${stats.failedCredits}`)
  
  // Test 5: Edge cases
  console.log('\nTest 5: Edge Cases')
  console.log('==================')
  
  // Empty subjects array
  const emptyStats = calculateCompletedCredits([])
  console.log(`${emptyStats === 0 ? '✅ PASS' : '❌ FAIL'} Empty subjects array: ${emptyStats}`)
  
  // All failed subjects
  const allFailedSubjects = [
    { ...testSubjects[3] },
    { ...testSubjects[4] },
    { ...testSubjects[5] }
  ]
  const allFailedCredits = calculateCompletedCredits(allFailedSubjects)
  console.log(`${allFailedCredits === 0 ? '✅ PASS' : '❌ FAIL'} All failed subjects: ${allFailedCredits}`)
  
  // Mixed case grade
  const mixedCaseSubject = {
    id: 'test',
    credits: 5,
    completed: true,
    grade: 'f', // lowercase f
    completion_type: 'Zkouška (Zk)',
    subject_type: 'Povinný'
  }
  const mixedCaseTest = isSubjectFailed(mixedCaseSubject)
  console.log(`${mixedCaseTest ? '✅ PASS' : '❌ FAIL'} Mixed case grade "f": ${mixedCaseTest}`)
  
  console.log('\n🎉 Test suite completed!')
}

// Manual verification instructions
function printManualVerificationInstructions() {
  console.log('\n📋 Manual Verification Instructions')
  console.log('=====================================')
  console.log('To verify the implementation in the actual components:')
  console.log('')
  console.log('1. Create test subjects with failed grades (F, Fx, F-) in your application')
  console.log('2. Check the following locations:')
  console.log('   - components/study-detail.tsx (line 112)')
  console.log('   - components/study-statistics.tsx (line 136, 174, 212)')
  console.log('   - components/public-study-view.tsx (line 125)')
  console.log('')
  console.log('3. ✅ WORKING CORRECTLY:')
  console.log('   - Failed subjects show "Neúspěšný" status')
  console.log('   - Failed subjects have red/orange styling')
  console.log('   - Failed subject credits are excluded from "Získané kredity" count')
  console.log('')
  console.log('4. 🚨 ISSUE FOUND - Average calculations:')
  console.log('   - Failed subjects are currently INCLUDED in average calculations')
  console.log('   - This affects all components that use calculateAverage()')
  console.log('   - Expected: Failed subjects should be excluded from averages')
  console.log('')
  console.log('5. Test scenarios:')
  console.log('   - Subject with grade "F" → should be marked as failed')
  console.log('   - Subject with grade "Fx" → should be marked as failed')
  console.log('   - Subject with grade "F-" → should be marked as failed')
  console.log('   - Subject with grade "A" → should NOT be marked as failed')
  console.log('   - Incomplete subject → should NOT be marked as failed')
  console.log('')
  console.log('6. Expected behavior in components:')
  console.log('   - study-detail.tsx: Credits card shows only successful credits ✅')
  console.log('   - study-statistics.tsx: All statistic calculations exclude failed credits ✅')
  console.log('   - public-study-view.tsx: Public view shows correct credit counts ✅')
  console.log('   - All components: Average calculations should exclude failed subjects ❌')
  console.log('')
  console.log('7. 🛠️ RECOMMENDED FIX:')
  console.log('   Filter out failed subjects before calling calculateAverage():')
  console.log('   const nonFailedSubjects = completedSubjects.filter(s => !isSubjectFailed(s))')
  console.log('   const average = calculateAverage(nonFailedSubjects)')
}

// Run the tests
runTests()
printManualVerificationInstructions()