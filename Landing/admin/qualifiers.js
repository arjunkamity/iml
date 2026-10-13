/* India Mind League — stage-wise qualifier track (demo dataset)
   Keyed by competition id. Each stage carries a pass mark and the list of
   participants who attempted it, with their score (%). Qualified is computed
   as score >= pass. */
window.IML_QUALIFIERS = {
  C01: {
    reg: 12,
    desc: 'India Mind League\u0027s first digital qualifier — top scorers advance to the school zone rounds.',
    stages: [
      {
        name: 'Stage 1', mode: 'Online', pass: 40,
        desc: 'General Knowledge & Logical Reasoning quiz.',
        rows: [
          { id: 'R1001', name: 'Aarav Mehta', grade: '9', school: 'Amity International School, Saket', score: 42 },
          { id: 'R1002', name: 'Diya Sharma', grade: '10', school: 'Amity International School, Noida', score: 38 },
          { id: 'R1003', name: 'Kabir Rao', grade: '11', school: 'Amity International School, Gurugram 46', score: 30 },
          { id: 'R1004', name: 'Ananya Iyer', grade: '12', school: 'Amity International School, Vasundhara', score: 46 },
          { id: 'R1005', name: 'Vivaan Gupta', grade: '9', school: 'Amity International School, Mayur Vihar', score: 44 },
          { id: 'R1006', name: 'Myra Nair', grade: '10', school: 'Amity International School, Saket', score: 40 },
          { id: 'R1007', name: 'Reyansh Jain', grade: '11', school: 'Amity International School, Noida', score: 36 },
          { id: 'R1008', name: 'Saanvi Kapoor', grade: '12', school: 'Amity International School, Gurugram 46', score: 48 }
        ]
      },
      {
        name: 'Stage 2', mode: 'Online', pass: 50,
        desc: 'Advanced aptitude + current affairs.',
        rows: [
          { id: 'R1001', name: 'Aarav Mehta', grade: '9', school: 'Amity International School, Saket', score: 52 },
          { id: 'R1004', name: 'Ananya Iyer', grade: '12', school: 'Amity International School, Vasundhara', score: 48 },
          { id: 'R1005', name: 'Vivaan Gupta', grade: '9', school: 'Amity International School, Mayur Vihar', score: 55 },
          { id: 'R1006', name: 'Myra Nair', grade: '10', school: 'Amity International School, Saket', score: 45 },
          { id: 'R1008', name: 'Saanvi Kapoor', grade: '12', school: 'Amity International School, Gurugram 46', score: 60 }
        ]
      }
    ]
  },
  C02: {
    reg: 8,
    desc: 'Inter-school challenge with three progressive stages from online quiz to face-to-face interview.',
    stages: [
      {
        name: 'Stage 1', mode: 'Online', pass: 40,
        desc: 'GK + Maths sprint.',
        rows: [
          { id: 'R1001', name: 'Aarav Mehta', grade: '9', school: 'Amity International School, Saket', score: 55 },
          { id: 'R1002', name: 'Diya Sharma', grade: '10', school: 'Amity International School, Noida', score: 60 },
          { id: 'R1003', name: 'Kabir Rao', grade: '11', school: 'Amity International School, Gurugram 46', score: 42 },
          { id: 'R1005', name: 'Vivaan Gupta', grade: '9', school: 'Amity International School, Mayur Vihar', score: 38 },
          { id: 'R1006', name: 'Myra Nair', grade: '10', school: 'Amity International School, Saket', score: 45 },
          { id: 'R1008', name: 'Saanvi Kapoor', grade: '12', school: 'Amity International School, Gurugram 46', score: 35 }
        ]
      },
      {
        name: 'Stage 2', mode: 'Hybrid', pass: 50,
        desc: 'Offline written + online tie-breaker.',
        rows: [
          { id: 'R1001', name: 'Aarav Mehta', grade: '9', school: 'Amity International School, Saket', score: 58 },
          { id: 'R1002', name: 'Diya Sharma', grade: '10', school: 'Amity International School, Noida', score: 52 },
          { id: 'R1003', name: 'Kabir Rao', grade: '11', school: 'Amity International School, Gurugram 46', score: 46 },
          { id: 'R1006', name: 'Myra Nair', grade: '10', school: 'Amity International School, Saket', score: 40 }
        ]
      },
      {
        name: 'Stage 3', mode: 'Peer Interview', pass: 60,
        desc: 'Panel interview with peers and mentors.',
        rows: [
          { id: 'R1001', name: 'Aarav Mehta', grade: '9', school: 'Amity International School, Saket', score: 64 },
          { id: 'R1002', name: 'Diya Sharma', grade: '10', school: 'Amity International School, Noida', score: 61 }
        ]
      }
    ]
  },
  C03: {
    reg: 0,
    desc: 'National finals — champions of each zone compete for the top scholarship.',
    stages: [
      {
        name: 'National Final', mode: 'Peer Interview', pass: 60,
        desc: 'Grand finale interview + on-stage rapid fire.',
        rows: []
      }
    ]
  }
};
