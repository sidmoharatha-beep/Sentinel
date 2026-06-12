const Joi = require('joi');

const ROLES = ['system_admin', 'security_manager', 'security_supervisor', 'security_guard'];
const SHIFTS = ['A', 'B', 'C'];
const INCIDENT_CATEGORIES = ['Security', 'Safety', 'Fire', 'Housekeeping', 'Environmental', 'Equipment'];
const INCIDENT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const INCIDENT_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const CHECKLIST_RESPONSES = ['ok', 'issue', 'na'];
const AREA_TYPES = ['critical', 'operational', 'support'];

const schemas = {
  // Employee ID + Password login
  login: Joi.object({
    employee_id: Joi.string().min(3).max(50).required()
      .messages({ 'any.required': 'Employee ID is required' }),
    password: Joi.string().min(6).required()
  }),

  createUser: Joi.object({
    employee_id: Joi.string().min(3).max(20).required(),
    username: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    full_name: Joi.string().min(2).max(100).required(),
    role: Joi.string().valid(...ROLES).required(),
    phone: Joi.string().max(20).allow(null, ''),
    shift: Joi.string().valid(...SHIFTS).allow(null, '')
  }),

  updateUser: Joi.object({
    email: Joi.string().email(),
    full_name: Joi.string().min(2).max(100),
    role: Joi.string().valid(...ROLES),
    phone: Joi.string().max(20).allow(null, ''),
    shift: Joi.string().valid(...SHIFTS).allow(null, ''),
    is_active: Joi.boolean()
  }).min(1),

  createSite: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).max(200).required(),
    city: Joi.string().max(50).allow(null, ''),
    state: Joi.string().max(50).allow(null, ''),
    zip: Joi.string().max(20).allow(null, ''),
    contact_name: Joi.string().max(100).allow(null, ''),
    contact_phone: Joi.string().max(20).allow(null, ''),
    contact_email: Joi.string().email().allow(null, '')
  }),

  updateSite: Joi.object({
    name: Joi.string().min(2).max(100),
    address: Joi.string().min(5).max(200),
    city: Joi.string().max(50).allow(null, ''),
    state: Joi.string().max(50).allow(null, ''),
    zip: Joi.string().max(20).allow(null, ''),
    contact_name: Joi.string().max(100).allow(null, ''),
    contact_phone: Joi.string().max(20).allow(null, ''),
    contact_email: Joi.string().email().allow(null, ''),
    is_active: Joi.boolean()
  }).min(1),

  createCheckpoint: Joi.object({
    site_id: Joi.number().integer().positive().required(),
    checkpoint_code: Joi.string().min(2).max(10).required(),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).allow(null, ''),
    area_type: Joi.string().valid(...AREA_TYPES).required(),
    patrol_frequency_hours: Joi.number().valid(1, 2, 4).required(),
    qr_code: Joi.string().max(50).allow(null, ''),
    latitude: Joi.number().allow(null),
    longitude: Joi.number().allow(null)
  }),

  createRoute: Joi.object({
    site_id: Joi.number().integer().positive().required(),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).allow(null, ''),
    schedule_type: Joi.string().valid('hourly', 'shift', 'custom').required(),
    schedule_config: Joi.string().max(1000).allow(null, '')
  }),

  createPatrol: Joi.object({
    route_id: Joi.number().integer().positive().allow(null),
    guard_id: Joi.number().integer().positive().required(),
    site_id: Joi.number().integer().positive().required(),
    shift: Joi.string().valid(...SHIFTS).required(),
    scheduled_start: Joi.date().iso().required(),
    scheduled_end: Joi.date().iso().required(),
    notes: Joi.string().max(1000).allow(null, '')
  }),

  updatePatrol: Joi.object({
    status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'missed', 'overdue'),
    actual_start: Joi.date().iso().allow(null),
    actual_end: Joi.date().iso().allow(null),
    notes: Joi.string().max(1000).allow(null, '')
  }).min(1),

  scanCheckpoint: Joi.object({
    checkpoint_id: Joi.number().integer().positive().required(),
    qr_code: Joi.string().max(50).allow(null, ''),
    notes: Joi.string().max(1000).allow(null, ''),
    latitude: Joi.number().allow(null),
    longitude: Joi.number().allow(null),
    gps_accuracy: Joi.number().allow(null),
    photo_url: Joi.string().max(500).allow(null, ''),
    checklist_responses: Joi.array().items(
      Joi.object({
        checklist_item_id: Joi.number().integer().positive().required(),
        response: Joi.string().valid(...CHECKLIST_RESPONSES).required(),
        notes: Joi.string().max(500).allow(null, '')
      })
    ).allow(null)
  }),

  createIncident: Joi.object({
    site_id: Joi.number().integer().positive().required(),
    guard_id: Joi.number().integer().positive().allow(null),
    patrol_id: Joi.number().integer().positive().allow(null),
    checkpoint_id: Joi.number().integer().positive().allow(null),
    category: Joi.string().valid(...INCIDENT_CATEGORIES).required(),
    severity: Joi.string().valid(...INCIDENT_SEVERITIES).required(),
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).allow(null, ''),
    latitude: Joi.number().allow(null),
    longitude: Joi.number().allow(null),
    photo_url: Joi.string().max(500).allow(null, '')
  }),

  updateIncident: Joi.object({
    status: Joi.string().valid(...INCIDENT_STATUSES),
    resolution_notes: Joi.string().max(2000).allow(null, ''),
    severity: Joi.string().valid(...INCIDENT_SEVERITIES),
    closure_evidence_url: Joi.string().max(500).allow(null, '')
  }).min(1),

  createCompliance: Joi.object({
    site_id: Joi.number().integer().positive().required(),
    shift: Joi.string().valid(...SHIFTS).allow(null, ''),
    record_type: Joi.string().valid('patrol_completion', 'incident_response', 'training', 'equipment_check', 'audit').required(),
    details: Joi.string().max(2000).allow(null, '')
  }),

  updateCompliance: Joi.object({
    status: Joi.string().valid('pending', 'passed', 'failed', 'needs_review'),
    score: Joi.number().min(0).max(100).allow(null),
    details: Joi.string().max(2000).allow(null, '')
  }).min(1)
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    next();
  };
}

module.exports = { validate };
