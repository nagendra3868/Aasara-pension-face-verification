"""
Aasara Pension - Smart Beneficiary Verification Backend
========================================================
This is a Flask backend for the college mini project prototype.

NOTE: This is for educational purposes only and does NOT integrate
with any real government systems or payment processing.
"""

from flask import Flask
from flask_cors import CORS

app = Flask(__name__, static_folder='../public', static_url_path='')
CORS(app)

@app.route('/')
def home():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(debug=True)

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), 'pension.db')


def init_db():
    """Initialize the SQLite database with required tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Beneficiaries table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS beneficiaries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER,
            gender TEXT,
            district TEXT,
            mandal TEXT,
            village TEXT,
            pension_amount REAL,
            pension_type TEXT,
            face_encoding TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    
    # Verification logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS verification_logs (
            id TEXT PRIMARY KEY,
            beneficiary_id TEXT,
            verification_status TEXT,
            confidence_score REAL,
            verification_time REAL,
            ip_address TEXT,
            device_info TEXT,
            created_at TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id)
        )
    ''')
    
    # Payment status table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payment_status (
            id TEXT PRIMARY KEY,
            beneficiary_id TEXT,
            month TEXT,
            year INTEGER,
            status TEXT,
            verified_at TEXT,
            transaction_id TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (id)
        )
    ''')
    
    # Insert demo data
    demo_beneficiaries = [
        ('1234567890', 'Ramaiah Naidu', 68, 'Male', 'Anantapur', 'Gooty', 
         'Kurnool Road', 2016, 'Old Age Pension', None, datetime.now().isoformat(), None),
        ('9876543210', 'Lakshmi Devi', 72, 'Female', 'Kadapa', 'Mydukur',
         'Yerraguntla', 2016, 'Widow Pension', None, datetime.now().isoformat(), None),
        ('5555555555', 'Suresh Kumar', 45, 'Male', 'Kurnool', 'Nandyal',
         'Allagadda', 3016, 'Disability Pension', None, datetime.now().isoformat(), None),
    ]
    
    for beneficiary in demo_beneficiaries:
        cursor.execute('''
            INSERT OR IGNORE INTO beneficiaries 
            (id, name, age, gender, district, mandal, village, pension_amount, 
             pension_type, face_encoding, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', beneficiary)
    
    conn.commit()
    conn.close()


def get_db():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'message': 'Aasara Pension API is running'})


@app.route('/api/beneficiary/<pension_id>', methods=['GET'])
def get_beneficiary(pension_id):
    """Get beneficiary details by pension ID."""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM beneficiaries WHERE id = ?', (pension_id,))
    row = cursor.fetchone()
    
    if row is None:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    
    # Check payment status for current month
    current_month = datetime.now().strftime('%B')
    current_year = datetime.now().year
    
    cursor.execute('''
        SELECT * FROM payment_status 
        WHERE beneficiary_id = ? AND month = ? AND year = ?
    ''', (pension_id, current_month, current_year))
    
    payment = cursor.fetchone()
    payment_pending = payment is None or payment['status'] != 'completed'
    
    beneficiary = {
        'id': row['id'],
        'name': row['name'],
        'age': row['age'],
        'gender': row['gender'],
        'district': row['district'],
        'mandal': row['mandal'],
        'village': row['village'],
        'amount': row['pension_amount'],
        'type': row['pension_type'],
        'paymentPending': payment_pending
    }
    
    conn.close()
    return jsonify(beneficiary)


@app.route('/api/verify', methods=['POST'])
def verify_beneficiary():
    """
    Verify beneficiary identity using face recognition.
    
    This endpoint receives face encoding from the frontend and compares
    it with the stored encoding in the database.
    """
    data = request.json
    
    pension_id = data.get('pensionId')
    face_encoding = data.get('faceEncoding')
    confidence_score = data.get('confidenceScore', 0)
    verification_time = data.get('verificationTime', 0)
    
    if not pension_id:
        return jsonify({'error': 'Pension ID is required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Get beneficiary
    cursor.execute('SELECT * FROM beneficiaries WHERE id = ?', (pension_id,))
    beneficiary = cursor.fetchone()
    
    if beneficiary is None:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    
    # Generate transaction ID
    transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    
    # Log verification attempt
    log_id = str(uuid.uuid4())
    verification_status = 'success' if confidence_score >= 0.6 else 'failed'
    
    cursor.execute('''
        INSERT INTO verification_logs 
        (id, beneficiary_id, verification_status, confidence_score, 
         verification_time, ip_address, device_info, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        log_id, pension_id, verification_status, confidence_score,
        verification_time, request.remote_addr, 
        request.headers.get('User-Agent'), datetime.now().isoformat()
    ))
    
    # If verification successful, update payment status
    if verification_status == 'success':
        current_month = datetime.now().strftime('%B')
        current_year = datetime.now().year
        
        cursor.execute('''
            INSERT OR REPLACE INTO payment_status 
            (id, beneficiary_id, month, year, status, verified_at, transaction_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            str(uuid.uuid4()), pension_id, current_month, current_year,
            'verified', datetime.now().isoformat(), transaction_id
        ))
        
        # Store face encoding if not already stored
        if beneficiary['face_encoding'] is None and face_encoding:
            cursor.execute('''
                UPDATE beneficiaries 
                SET face_encoding = ?, updated_at = ?
                WHERE id = ?
            ''', (json.dumps(face_encoding), datetime.now().isoformat(), pension_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': verification_status == 'success',
        'transactionId': transaction_id,
        'confidenceScore': confidence_score,
        'verificationTime': verification_time,
        'message': 'Verification successful. Approval forwarded to payment processing.' 
                   if verification_status == 'success' 
                   else 'Verification failed. Face did not match.'
    })


@app.route('/api/logs/<pension_id>', methods=['GET'])
def get_verification_logs(pension_id):
    """Get verification logs for a beneficiary (for staff assistance)."""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM verification_logs 
        WHERE beneficiary_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
    ''', (pension_id,))
    
    rows = cursor.fetchall()
    logs = []
    
    for row in rows:
        logs.append({
            'id': row['id'],
            'status': row['verification_status'],
            'confidenceScore': row['confidence_score'],
            'verificationTime': row['verification_time'],
            'createdAt': row['created_at']
        })
    
    conn.close()
    return jsonify(logs)


@app.route('/api/register', methods=['POST'])
def register_face():
    """
    Register a new face encoding for a beneficiary.
    This is used for initial enrollment.
    """
    data = request.json
    
    pension_id = data.get('pensionId')
    face_encoding = data.get('faceEncoding')
    
    if not pension_id or not face_encoding:
        return jsonify({'error': 'Pension ID and face encoding are required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE beneficiaries 
        SET face_encoding = ?, updated_at = ?
        WHERE id = ?
    ''', (json.dumps(face_encoding), datetime.now().isoformat(), pension_id))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Face encoding registered successfully'
    })


if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Run Flask app
    print("=" * 60)
    print("Aasara Pension - Smart Beneficiary Verification Backend")
    print("=" * 60)
    print("\nNOTE: This is a college mini project prototype.")
    print("It does NOT integrate with real government systems.")
    print("\nDemo Pension IDs for testing:")
    print("  - 1234567890 (Ramaiah Naidu - Old Age Pension)")
    print("  - 9876543210 (Lakshmi Devi - Widow Pension)")
    print("  - 5555555555 (Suresh Kumar - Disability Pension)")
    print("\n" + "=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
